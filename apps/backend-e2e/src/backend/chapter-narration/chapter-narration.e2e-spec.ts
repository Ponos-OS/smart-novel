import axios from 'axios';
import { createClient } from 'graphql-ws';
import Redis from 'ioredis';
import { WebSocket } from 'ws';

import { AuthorizationFixture } from '../../support';
import { ChapterNarrationFixture } from './chapter-narration.fixture';

/** @description Must match `TTS_STATUS_CHANNEL` in apps/backend/src/modules/tts-callbacks/constants.ts */
const TTS_STATUS_CHANNEL = 'tts-audio:status';

describe('Chapter Narration (e2e)', () => {
  let fixture: ChapterNarrationFixture;

  beforeEach(() => {
    fixture = new ChapterNarrationFixture();
  });

  const NOVEL_ID = 'c1d31ec2-f478-4648-b90b-d1e53de2a829';
  const CHAPTER_ONE_ID = '4dd92f16-4743-47b9-960c-6529678e9bc5';
  // Chapter 2 (4769a024-...) is deliberately left to beatrice-callbacks.e2e-spec.ts's
  // Step 2.1/2.2 tests — this file's real-generation tests use chapters 1/3/4 instead,
  // so the two files' narration locks/status messages don't race each other.
  const CHAPTER_THREE_ID = 'a3987a2f-eaa5-4a05-8714-34a110511cba';
  const CHAPTER_FOUR_ID = '038dd3f5-e921-4076-be91-66175ebd1bc3';

  it('should start chapter audio generation and return PROCESSING status', async () => {
    const authorizationHeader =
      await AuthorizationFixture.getWriterAuthorizationHeader();

    const res = await axios.post(
      '/graphql',
      {
        query: `#graphql
          mutation GenerateChapterAudio($id: ID!) {
            generateChapterAudio(id: $id) {
              status
              narrationUrl
            }
          }
        `,
        variables: {
          id: CHAPTER_ONE_ID,
        },
      },
      { headers: { Authorization: authorizationHeader } },
    );

    expect(res.status).toBe(200);
    expect(res.data.errors).toBeUndefined();
    expect(res.data.data.generateChapterAudio).toMatchObject({
      status: 'PROCESSING',
      narrationUrl: null,
    });
  }, 120_000);

  it('should always regenerate audio, even once a narrationUrl already exists', async () => {
    await fixture.generateChapterAudio(CHAPTER_FOUR_ID);
    await fixture.waitFor(NOVEL_ID, CHAPTER_FOUR_ID);

    // Act: call again now that the first job's lock has been released on completion —
    // there's no forceRegenerate anymore, a plain call always regenerates.
    const authorizationHeader =
      await AuthorizationFixture.getWriterAuthorizationHeader();
    const res = await axios.post(
      '/graphql',
      {
        query: `#graphql
          mutation GenerateChapterAudio($id: ID!) {
            generateChapterAudio(id: $id) {
              status
            }
          }
        `,
        variables: {
          id: CHAPTER_FOUR_ID,
        },
      },
      { headers: { Authorization: authorizationHeader } },
    );

    expect(res.data.errors).toBeUndefined();
    expect(res.data.data.generateChapterAudio).toEqual({
      status: 'PROCESSING',
    });
  }, 220_000);

  it('should reject a second generateChapterAudio call while one is already in flight for the same chapter', async () => {
    const authorizationHeader =
      await AuthorizationFixture.getWriterAuthorizationHeader();
    const query = `#graphql
      mutation GenerateChapterAudio($id: ID!) {
        generateChapterAudio(id: $id) {
          status
        }
      }
    `;
    const host = process.env.HOST ?? 'localhost';
    const port = process.env.REDIS_PORT ?? '6379';
    const redisSubscriber = new Redis(`redis://${host}:${port}`, {
      password: process.env.REDIS_PASSWORD,
    });

    try {
      // Arrange: listen for the real jobId Beatrice assigns, so we can release its
      // lock ourselves at the end — otherwise this chapter stays locked (up to the
      // 1h TTL) until the real, unmocked Beatrice job happens to finish on its own,
      // which would leak into (and likely time out) any later test on this chapter.
      const queued = new Promise<{ jobId: string }>(
        (resolve, reject) => {
          const timeout = setTimeout(
            () =>
              reject(
                new Error('No "queued" message received in 30s'),
              ),
            30_000,
          );

          redisSubscriber.on('message', (channel, message) => {
            if (channel !== TTS_STATUS_CHANNEL) {
              return;
            }
            const parsed = JSON.parse(message);
            if (parsed.status !== 'queued') {
              return;
            }
            clearTimeout(timeout);
            resolve(parsed);
          });
        },
      );
      await redisSubscriber.subscribe(TTS_STATUS_CHANNEL);

      // Act: fire the first call (kicks off a real, in-flight Beatrice job — the lock
      // stays held until it reaches a terminal status) and immediately fire a second one.
      const firstRes = await axios.post(
        '/graphql',
        { query, variables: { id: CHAPTER_THREE_ID } },
        { headers: { Authorization: authorizationHeader } },
      );
      const secondRes = await axios.post(
        '/graphql',
        { query, variables: { id: CHAPTER_THREE_ID } },
        { headers: { Authorization: authorizationHeader } },
      );

      // Assert
      expect(firstRes.data.errors).toBeUndefined();
      expect(firstRes.data.data.generateChapterAudio).toEqual({
        status: 'PROCESSING',
      });
      expect(secondRes.data.errors).toBeDefined();
      expect(secondRes.data.errors[0].message).toContain(
        'already in progress',
      );

      // Cleanup: terminate the first call's job so its lock doesn't linger into
      // later tests on this chapter.
      const { jobId } = await queued;
      await axios.post('/beatrice-callbacks/status', {
        jobId,
        status: 'failed',
        failedAt: new Date().toISOString(),
        error: {
          code: 'TTS_PROVIDER_ERROR',
          message: 'test cleanup',
        },
      });
    } finally {
      await redisSubscriber.quit();
    }
  }, 60_000);

  it('should return the narration URL', async () => {
    // Arrange & Act
    await fixture.generateChapterAudio(CHAPTER_ONE_ID);
    const narrationUrl = await fixture.waitFor(
      NOVEL_ID,
      CHAPTER_ONE_ID,
    );

    // Assert
    expect(narrationUrl).toBeTruthy();
    expect(narrationUrl).toContain('narrations/');
    expect(narrationUrl).toContain('.mp3');
  }, 200_000);

  it('should return error for non-existent chapter', async () => {
    const authorizationHeader =
      await AuthorizationFixture.getWriterAuthorizationHeader();
    const res = await axios.post(
      '/graphql',
      {
        query: `#graphql
          mutation GenerateChapterAudio($id: ID!) {
            generateChapterAudio(id: $id) {
              status
            }
          }
        `,
        variables: {
          id: 'b7cd872e-bc6b-4bad-be35-72df84d100f4',
        },
      },
      { headers: { Authorization: authorizationHeader } },
    );

    expect(res.data.errors).toBeDefined();
    expect(res.data.errors[0].message).toContain(
      'You do not have permission',
    );
  });

  it('should subscribe to chapter narration updates', async () => {
    // Arrange
    const host = process.env.HOST ?? 'localhost';
    const port = process.env.TRAEFIK_EXPOSED_PORT ?? '8080';
    const client = createClient({
      url: `ws://${host}:${port}/graphql`,
      webSocketImpl: WebSocket,
    });

    // Act
    try {
      const eventPromise = new Promise<{ narrationUrl: string }>(
        async (resolve, reject) => {
          const unsubscribe = client.subscribe(
            {
              query: `#graphql
                subscription ChapterNarrationUpdated($chapterId: ID!) {
                  chapterNarrationUpdated(chapterId: $chapterId) {
                    status
                    narrationUrl
                    error
                  }
                }
              `,
              variables: {
                chapterId: CHAPTER_THREE_ID,
              },
            },
            {
              next: (data: any) => {
                const event = data.data?.chapterNarrationUpdated;
                // NOTE: Wait for event with narrationUrl (READY status)
                if (event?.narrationUrl) {
                  unsubscribe();
                  resolve(event);
                }
              },
              error: (error) => {
                unsubscribe();
                reject(error);
              },
              complete: () => {
                // README: Should NOT complete before we get the narrationUrl
              },
            },
          );
          await new Promise((resolve) => setTimeout(resolve, 100)); // <== Small delay to ensure subscription is active
          fixture.generateChapterAudio(CHAPTER_THREE_ID);
        },
      );
      const event = await eventPromise;

      // Assert
      expect(event.narrationUrl).toBeTruthy();
      expect(event.narrationUrl).toContain('narrations/');
      expect(event.narrationUrl).toContain('.mp3');
    } finally {
      client.dispose();
    }
  }, 280_000);
});

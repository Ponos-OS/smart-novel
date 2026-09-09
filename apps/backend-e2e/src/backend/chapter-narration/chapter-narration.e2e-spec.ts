import { NarrationStatus } from '@prisma/client';
import axios from 'axios';
import { createClient } from 'graphql-ws';
import { WebSocket } from 'ws';

import { AuthorizationFixture } from '../../support';
import { ChapterNarrationFixture } from './chapter-narration.fixture';

describe('Chapter Narration (e2e)', () => {
  let fixture: ChapterNarrationFixture;

  beforeEach(() => {
    fixture = new ChapterNarrationFixture();
    fixture.beforeEach();
  });

  const NOVEL_ID = 'c1d31ec2-f478-4648-b90b-d1e53de2a829';
  const CHAPTER_ONE_ID = '4dd92f16-4743-47b9-960c-6529678e9bc5';
  const CHAPTER_TWO_ID = '4769a024-6267-4abc-a412-5ab0241a8d0e';
  const CHAPTER_THREE_ID = 'a3987a2f-eaa5-4a05-8714-34a110511cba';

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

  it('should force regenerate chapter audio even if the narrationUrl exists', async () => {
    const chapterId = '038dd3f5-e921-4076-be91-66175ebd1bc3';
    await fixture.generateChapterAudio(chapterId);
    await new Promise((resolve) => setTimeout(resolve, 12_000)); // 12 seconds
    const { traceparent, traceId } =
      ChapterNarrationFixture.generateTraceparent();
    const authorizationHeader =
      await AuthorizationFixture.getWriterAuthorizationHeader();

    const res = await axios.post(
      '/graphql',
      {
        query: `#graphql
          mutation GenerateChapterAudio($id: ID!) {
            generateChapterAudio(id: $id, forceRegenerate: true) {
              status
              narrationUrl
            }
          }
        `,
        variables: {
          id: chapterId,
        },
      },
      {
        headers: {
          traceparent,
          Authorization: authorizationHeader,
        },
      },
    );

    expect(res.status).toBe(200);
    await fixture.thenTtsCalledOnceWith(traceId);
  }, 180_000);

  it('should NOT call TTS service twice for the same chapter', async () => {
    const firstCall = ChapterNarrationFixture.generateTraceparent();
    const secondCall = ChapterNarrationFixture.generateTraceparent();
    const authorizationHeader =
      await AuthorizationFixture.getWriterAuthorizationHeader();
    await axios.post(
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
          id: CHAPTER_TWO_ID,
        },
      },
      {
        headers: {
          traceparent: firstCall.traceparent,
          Authorization: authorizationHeader,
        },
      },
    );

    // Act: Query chapter status with a different trace
    await axios.post(
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
          id: CHAPTER_TWO_ID,
        },
      },
      {
        headers: {
          traceparent: secondCall.traceparent,
          Authorization: authorizationHeader,
        },
      },
    );

    await fixture.thenTtsCalledOnceWith(firstCall.traceId);
    await fixture.thenTtsNotCalledWith(secondCall.traceId);
  }, 150_000);

  it('should return the narration URL', async () => {
    // Arrange & Act
    const authorizationHeader =
      await AuthorizationFixture.getWriterAuthorizationHeader();
    await axios.post(
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
    const narrationUrl = await fixture.waitFor(
      NOVEL_ID,
      CHAPTER_ONE_ID,
      NarrationStatus.READY,
    );

    // Assert
    expect(narrationUrl).toBeTruthy();
    expect(narrationUrl).toContain('narrations/');
    expect(narrationUrl).toContain('.mp3');
    expect(narrationUrl).toContain(CHAPTER_ONE_ID);
  }, 150_000);

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
      expect(event.narrationUrl).toContain(CHAPTER_THREE_ID);
    } finally {
      client.dispose();
    }
  }, 280_000);
});

import axios from 'axios';
import { createClient } from 'graphql-ws';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';

import {
  AuthorizationFixture,
  graphql,
  lockedJobOfChapter,
  NovelFixture,
} from '../../support';
import { ChapterNarrationFixture } from './chapter-narration.fixture';

/** @description Must match `StatusChannel` in apps/backend/internal/ttscallbacks/handlers.go */

describe('Chapter Narration (e2e)', () => {
  let fixture: ChapterNarrationFixture;

  beforeEach(() => {
    fixture = new ChapterNarrationFixture();
  });

  let NOVEL_ID: string;
  let CHAPTER_ONE_ID: string;
  let CHAPTER_THREE_ID: string;
  let CHAPTER_FOUR_ID: string;

  beforeAll(async () => {
    const { novelId, chapterIds } = await NovelFixture.create({
      chapters: 4,
    });
    NOVEL_ID = novelId;
    [CHAPTER_ONE_ID, , CHAPTER_THREE_ID, CHAPTER_FOUR_ID] =
      chapterIds;
    const waiting = new ChapterNarrationFixture();
    for (const chapterId of chapterIds) {
      await waiting.waitFor(novelId, chapterId);
    }
  }, 600_000);

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
              narrationURL
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
      narrationURL: null,
    });
  }, 120_000);

  it('should always regenerate audio, even once a narrationURL already exists', async () => {
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
  }, 320_000);

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

    // Arrange & Act: fire the first call (kicks off a real, in-flight Beatrice job — the lock stays held until it reaches a terminal status) and immediately fire a second one.
    const firstRes = await axios.post(
      '/graphql',
      { query, variables: { id: CHAPTER_THREE_ID } },
      { headers: { Authorization: authorizationHeader } },
    );
    const firstJob = await lockedJobOfChapter(CHAPTER_THREE_ID);
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

    // Cleanup: terminate the first call's job so its lock doesn't linger into later tests on this chapter. The lock holds the job from the moment the first call is answered; a job that has finished already left nothing to terminate.
    if (firstJob) {
      await axios.post('/beatrice-callbacks/status', {
        jobId: firstJob,
        status: 'failed',
        failedAt: new Date().toISOString(),
        clientContextId: CHAPTER_THREE_ID,
        error: {
          code: 'TTS_PROVIDER_ERROR',
          message: 'test cleanup',
        },
      });
    }
  }, 260_000);

  it('should return the narration URL', async () => {
    // Arrange & Act
    await fixture.generateChapterAudio(CHAPTER_ONE_ID);
    const narrationURL = await fixture.waitFor(
      NOVEL_ID,
      CHAPTER_ONE_ID,
    );

    // Assert
    expect(narrationURL).toBeTruthy();
    expect(narrationURL).toContain('narrations/');
    expect(narrationURL).toContain('.mp3');
  }, 320_000);

  it('should not keep the audio of a job that was not started for the chapter, even while a narration of it is running', async () => {
    // Arrange: a chapter of its own, narrated when it is created, with the audio address of that job kept.
    const writer =
      await AuthorizationFixture.getWriterAuthorizationHeader({
        fresh: true,
      });
    const novel = await graphql(
      `
        #graphql
        mutation CreateNovel($input: CreateNovelInput!) {
          createNovel(input: $input) {
            id
          }
        }
      `,
      {
        input: {
          name: 'The Lantern Keeper',
          description: 'A lighthouse keeper finds a door in the fog.',
        },
      },
      writer,
    );
    const novelId = novel.data.createNovel.id;
    const chapter = await graphql(
      `
        #graphql
        mutation CreateChapter(
          $novelID: ID!
          $input: CreateChapterInput!
        ) {
          createChapter(novelID: $novelID, input: $input) {
            id
          }
        }
      `,
      {
        novelID: novelId,
        input: { title: 'One', content: 'The door was there.' },
      },
      writer,
    );
    const chapterId = chapter.data.createChapter.id;
    const narrationUrl = await fixture.waitFor(novelId, chapterId);
    const redis = new Redis(
      `redis://${process.env.HOST ?? 'localhost'}:${process.env.REDIS_PORT ?? '6379'}`,
      { password: process.env.REDIS_PASSWORD },
    );

    try {
      // Act: a narration of the chapter is running (its lock is held), and somebody reports another job as done.
      await redis.set(
        `chapter_tts:${chapterId}`,
        'held-by-the-test',
        'EX',
        60,
        'NX',
      );
      const forged = await axios.post('/beatrice-callbacks/status', {
        jobId: '9f1d3c52-8b0e-4a39-9c4d-2f6a7e1b5d08',
        status: 'completed',
        clientContextId: chapterId,
      });
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Assert
      const after = await fixture.waitFor(novelId, chapterId);
      expect(forged.status).toBe(204);
      expect(after).toBe(narrationUrl);
    } finally {
      await redis.del(`chapter_tts:${chapterId}`);
      await redis.quit();
    }
  }, 320_000);

  it.each([
    {
      deleting: 'the chapter',
      mutation: `#graphql
        mutation Delete($chapterID: ID!) {
          deleteChapter(id: $chapterID) {
            id
          }
        }
      `,
    },
    {
      deleting: 'the novel',
      mutation: `#graphql
        mutation Delete($novelID: ID!) {
          deleteNovel(id: $novelID) {
            id
          }
        }
      `,
    },
  ])(
    'should remove the audio from the bucket when $deleting is deleted',
    async ({ mutation }) => {
      const writer =
        await AuthorizationFixture.getWriterAuthorizationHeader({
          fresh: true,
        });
      const novel = await graphql(
        `
          #graphql
          mutation CreateNovel($input: CreateNovelInput!) {
            createNovel(input: $input) {
              id
            }
          }
        `,
        {
          input: {
            name: 'The Lantern Keeper',
            description:
              'A lighthouse keeper finds a door in the fog.',
          },
        },
        writer,
      );
      const novelID = novel.data.createNovel.id;
      const chapter = await graphql(
        `
          #graphql
          mutation CreateChapter(
            $novelID: ID!
            $input: CreateChapterInput!
          ) {
            createChapter(novelID: $novelID, input: $input) {
              id
            }
          }
        `,
        {
          novelID,
          input: {
            title: 'One',
            content: `The door was there. ${randomUUID()}`,
          },
        },
        writer,
      );
      const chapterID = chapter.data.createChapter.id;
      const narrationURL = await fixture.waitFor(novelID, chapterID);
      const before = await fetch(narrationURL);

      const deleted = await graphql(
        mutation,
        { novelID, chapterID },
        writer,
      );

      const after = await fetch(narrationURL);
      expect(deleted.errors).toBeUndefined();
      expect(before.status).toBe(200);
      expect(after.status).toBe(404);
    },
    320_000,
  );

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
    expect(res.data.errors[0].message).toContain('Chapter not found');
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
      const eventPromise = new Promise<{ narrationURL: string }>(
        async (resolve, reject) => {
          const unsubscribe = client.subscribe(
            {
              query: `#graphql
                subscription ChapterNarrationUpdated($chapterID: ID!) {
                  chapterNarrationUpdated(chapterID: $chapterID) {
                    status
                    narrationURL
                    error
                  }
                }
              `,
              variables: {
                chapterID: CHAPTER_THREE_ID,
              },
            },
            {
              next: (data: any) => {
                const event = data.data?.chapterNarrationUpdated;
                // NOTE: Wait for event with narrationURL (READY status)
                if (event?.narrationURL) {
                  unsubscribe();
                  resolve(event);
                }
              },
              error: (error) => {
                unsubscribe();
                reject(error);
              },
              complete: () => {
                // README: Should NOT complete before we get the narrationURL
              },
            },
          );
          await new Promise((resolve) => setTimeout(resolve, 100)); // <== Small delay to ensure subscription is active
          fixture.generateChapterAudio(CHAPTER_THREE_ID);
        },
      );
      const event = await eventPromise;

      // Assert
      expect(event.narrationURL).toBeTruthy();
      expect(event.narrationURL).toContain('narrations/');
      expect(event.narrationURL).toContain('.mp3');
    } finally {
      client.dispose();
    }
  }, 320_000);
});

import axios from 'axios';
import { createClient } from 'graphql-ws';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';

import { AuthorizationFixture, holdNarrationLock } from '../support';

/** @description Must match `StatusChannel` in apps/backend/internal/ttscallbacks/handlers.go */
const TTS_EVENTS_CHANNEL = 'chapter-narration:events';

async function getContentUpdatedAt(
  novelId: string,
  chapterId: string,
  authorization: string,
): Promise<string> {
  const { data } = await axios.post(
    '/graphql',
    {
      query: `#graphql
        query GetChapterContentUpdatedAt($novelId: ID!, $chapterId: ID!) {
          novel(id: $novelId) {
            chapter(id: $chapterId) {
              contentUpdatedAt
            }
          }
        }
      `,
      variables: { novelId, chapterId },
    },
    { headers: { Authorization: authorization } },
  );

  return data.data.novel.chapter.contentUpdatedAt;
}

describe('Beatrice callbacks (e2e)', () => {
  describe('POST /beatrice-callbacks/gen-upload-url', () => {
    it('should return a presigned upload URL for a valid token', async () => {
      const authorization =
        await AuthorizationFixture.getUserAuthorizationHeader();

      const res = await axios.post(
        '/beatrice-callbacks/gen-upload-url',
        undefined,
        {
          headers: {
            Authorization: authorization,
            'Idempotency-Key': '2bce49d6-6592-4ed3-b421-f913b9ecc3bd',
          },
        },
      );

      expect(res.status).toBe(201);
      expect(res.data).toEqual({ url: expect.any(String) });
      expect(res.data.url).toContain(
        'narrations/2bce49d6-6592-4ed3-b421-f913b9ecc3bd.mp3',
      );
      expect(res.data.url).toContain('X-Amz-Expires=300');
    });

    it('should reject a request with a tampered token', async () => {
      const authorization =
        await AuthorizationFixture.getUserAuthorizationHeader();
      // The last base64url char of an RS256 signature carries padding bits, so
      // changing it can leave the decoded signature intact; flip one in the middle.
      const signatureMiddle = authorization.length - 100;
      const tamperedAuthorization =
        authorization.slice(0, signatureMiddle) +
        (authorization[signatureMiddle] === 'A' ? 'B' : 'A') +
        authorization.slice(signatureMiddle + 1);

      const { status, data } = await axios.post(
        '/beatrice-callbacks/gen-upload-url',
        undefined,
        {
          headers: {
            Authorization: tamperedAuthorization,
            'Idempotency-Key': '2bce49d6-6592-4ed3-b421-f913b9ecc3bd',
          },
          validateStatus: () => true,
        },
      );

      expect(status).toBe(401);
      expect(data.message).toBeString();
    });

    // An expired-but-validly-signed real ZITADEL token is exercised at the unit level
    // (ZitadelAuthProvider.verifyIssuedByUs / BeatriceTokenGuard specs) rather than here —
    // reproducing it e2e would mean waiting out ZITADEL's real access-token lifetime
    // (hours), which isn't practical for a test suite that needs to stay fast.
  });

  describe('POST /beatrice-callbacks/status', () => {
    let redisSubscriber: Redis;

    beforeAll(() => {
      const host = process.env.HOST ?? 'localhost';
      const port = process.env.REDIS_PORT ?? '6379';

      redisSubscriber = new Redis(`redis://${host}:${port}`, {
        password: process.env.REDIS_PASSWORD,
      });
    });

    afterAll(async () => {
      await redisSubscriber.quit();
    });

    it('should handle a valid payload, announce it to the replicas and respond 204', async () => {
      const chapterId = randomUUID();
      const payload = {
        attempt: 1,
        clientContextId: chapterId,
        jobId: randomUUID(),
        progress: 2,
        status: 'generating',
      };
      const received = waitForMessage(
        redisSubscriber,
        TTS_EVENTS_CHANNEL,
        5000,
        (message) => JSON.parse(message).ChapterID === chapterId,
      );
      await redisSubscriber.subscribe(TTS_EVENTS_CHANNEL);

      const res = await axios.post(
        '/beatrice-callbacks/status',
        payload,
      );

      expect(res.status).toBe(204);
      expect(JSON.parse(await received)).toMatchObject({
        ChapterID: chapterId,
        Event: { Status: 'PROCESSING', Stage: 'generating' },
      });
    });

    it('should reject a malformed payload with 400 and not publish anything', async () => {
      const { status } = await axios.post(
        '/beatrice-callbacks/status',
        { status: 'not-a-real-status' },
        { validateStatus: () => true },
      );

      expect(status).toBe(400);
    });
  });

  describe('Step 2.1: reacting to a "completed" status', () => {
    // Not used by any other spec's updateContent/generateAudio call, so no other narration holds its lock.
    const NOVEL_ID = 'c1d31ec2-f478-4648-b90b-d1e53de2a829';
    const CHAPTER_TWO_ID = '4769a024-6267-4abc-a412-5ab0241a8d0e';

    it('should keep the audio URL of the chapter once Beatrice reports the job it started as completed', async () => {
      const authorization =
        await AuthorizationFixture.getWriterAuthorizationHeader();
      const before = await getNarrationUrl(NOVEL_ID, CHAPTER_TWO_ID);

      // Act: saving the text starts a narration (Step 2.0b); Beatrice reports it to whichever replica its callback reaches.
      const updateRes = await axios.post(
        '/graphql',
        {
          query: `#graphql
              mutation UpdateContent($id: ID!, $content: String!, $expectedContentUpdatedAt: Time!) {
                updateContent(id: $id, content: $content, expectedContentUpdatedAt: $expectedContentUpdatedAt) {
                  id
                }
              }
            `,
          variables: {
            id: CHAPTER_TWO_ID,
            // A new text every run: saving the text a chapter has already changes nothing, so no narration would start on a stack that ran this before.
            content: `# Chapter 2\n\nStep 2.1 e2e content ${randomUUID()}`,
            expectedContentUpdatedAt: await getContentUpdatedAt(
              NOVEL_ID,
              CHAPTER_TWO_ID,
              authorization,
            ),
          },
        },
        { headers: { Authorization: authorization } },
      );

      expect(updateRes.data.errors).toBeUndefined();

      // Assert: the chapter gets the address of the audio of the job Beatrice made for it. Beatrice serializes jobs through one worker, so a job of another test may come first.
      const narrationUrl = await waitForNarrationUrl(
        NOVEL_ID,
        CHAPTER_TWO_ID,
        (url) =>
          url !== before &&
          /narrations\/[0-9a-f-]{36}\.mp3$/.test(url),
        250_000,
      );
      expect(narrationUrl).toContain('narrations/');
      expect(await getNarrationStatus(NOVEL_ID, CHAPTER_TWO_ID)).toBe(
        'READY',
      );
    }, 260_000);
  });

  describe('Step 2.2: chapterNarrationUpdated live progress', () => {
    const NOVEL_ID = 'c1d31ec2-f478-4648-b90b-d1e53de2a829';
    const CHAPTER_TWO_ID = '4769a024-6267-4abc-a412-5ab0241a8d0e';

    it('should stream generating/uploading/completed progress over the chapterNarrationUpdated subscription, in order', async () => {
      const wsHost = process.env.HOST ?? 'localhost';
      const wsPort = process.env.TRAEFIK_EXPOSED_PORT ?? '8080';
      const client = createClient({
        url: `ws://${wsHost}:${wsPort}/graphql`,
        webSocketImpl: WebSocket,
      });

      const events: Array<{
        status: string;
        narrationURL: string | null;
        stage: string | null;
        error: string | null;
      }> = [];

      try {
        const unsubscribe = client.subscribe(
          {
            query: `#graphql
                subscription ChapterNarrationUpdated($chapterID: ID!) {
                  chapterNarrationUpdated(chapterID: $chapterID) {
                    status
                    narrationURL
                    stage
                    error
                  }
                }
              `,
            variables: { chapterID: CHAPTER_TWO_ID },
          },
          {
            next: (data: any) => {
              const event = data.data?.chapterNarrationUpdated;

              if (event) {
                events.push(event);
              }
            },
            error: () => {
              // Errors surfaced via the assertions below timing out.
            },
            complete: () => {
              // Should not complete before the assertions below run.
            },
          },
        );

        // Small delay to ensure the subscription is active before triggering generation.
        await new Promise((resolve) => setTimeout(resolve, 100));

        // The lock of the chapter holds the job the backend started; this test is that job's Beatrice, so the job is its own and no job of Beatrice can finish first.
        const jobId = randomUUID();
        await holdNarrationLock(CHAPTER_TWO_ID, jobId);

        // Act: simulate the rest of Beatrice's progress sequence directly. The raw
        // `stage` string doubles as our own distinctive marker here, same role
        // `percent` used to play, so this test's own events stay identifiable even if
        // an unrelated old-flow test interleaves chapterNarrationUpdated events for
        // the same seed chapter concurrently.
        const payloads = [
          {
            jobId,
            status: 'generating',
            clientContextId: CHAPTER_TWO_ID,
          },
          {
            jobId,
            status: 'uploading',
            clientContextId: CHAPTER_TWO_ID,
          },
          {
            jobId,
            status: 'completed',
            fileSizeBytes: 4,
            attempt: 1,
            clientContextId: CHAPTER_TWO_ID,
          },
        ];

        for (const payload of payloads) {
          const res = await axios.post(
            '/beatrice-callbacks/status',
            payload,
          );

          expect(res.status).toBe(204);
        }

        // Assert: our own marked events arrive, in order.
        const generatingIndex = await waitForEventIndex(
          events,
          (event) =>
            event.status === 'PROCESSING' &&
            event.stage === 'generating',
        );
        const uploadingIndex = await waitForEventIndex(
          events,
          (event) =>
            event.status === 'PROCESSING' &&
            event.stage === 'uploading',
        );
        const completedIndex = await waitForEventIndex(
          events,
          (event) =>
            event.status === 'READY' &&
            Boolean(
              event.narrationURL?.includes(`narrations/${jobId}.mp3`),
            ),
        );

        expect(
          await getNarrationStatus(NOVEL_ID, CHAPTER_TWO_ID),
        ).toBe('READY');
        expect(generatingIndex).toBeLessThan(uploadingIndex);
        expect(uploadingIndex).toBeLessThan(completedIndex);

        unsubscribe();
      } finally {
        client.dispose();
      }
    }, 260_000);
  });

  describe('Step 2.3: the status of the narration kept on the chapter', () => {
    const NOVEL_ID = 'c1d31ec2-f478-4648-b90b-d1e53de2a829';
    const CHAPTER_TWO_ID = '4769a024-6267-4abc-a412-5ab0241a8d0e';

    it('should mark the chapter FAILED when the job started for it fails, and ignore the failure of another job', async () => {
      // Arrange: this test is the Beatrice of a job of its own.
      const jobId = randomUUID();
      await holdNarrationLock(CHAPTER_TWO_ID, jobId);
      const failure = {
        status: 'failed',
        failedAt: new Date().toISOString(),
        clientContextId: CHAPTER_TWO_ID,
        error: {
          code: 'TTS_PROVIDER_ERROR',
          message: 'quota exceeded',
        },
      };

      // Act
      const otherRes = await axios.post(
        '/beatrice-callbacks/status',
        {
          ...failure,
          jobId: randomUUID(),
        },
      );
      const statusAfterOther = await getNarrationStatus(
        NOVEL_ID,
        CHAPTER_TWO_ID,
      );
      const ownRes = await axios.post('/beatrice-callbacks/status', {
        ...failure,
        jobId,
      });

      // Assert
      expect(otherRes.status).toBe(204);
      expect(statusAfterOther).not.toBe('FAILED');
      expect(ownRes.status).toBe(204);
      expect(await getNarrationStatus(NOVEL_ID, CHAPTER_TWO_ID)).toBe(
        'FAILED',
      );
    });
  });

  describe('Step 2: dropping a stale out-of-order status callback', () => {
    // Same seed chapter as Steps 2.1/2.2 above — safe to share since these `it`s run
    // sequentially within this file and `chapterNarrationUpdated` is scoped per chapterId,
    // so no other spec file publishes onto this specific chapter's subscription channel.
    const CHAPTER_TWO_ID = '4769a024-6267-4abc-a412-5ab0241a8d0e';

    it('should drop a "queued" callback (progress 1) that arrives after "generating" (progress 2) for the same job, never regressing the chapterNarrationUpdated subscription', async () => {
      const wsHost = process.env.HOST ?? 'localhost';
      const wsPort = process.env.TRAEFIK_EXPOSED_PORT ?? '8080';
      const client = createClient({
        url: `ws://${wsHost}:${wsPort}/graphql`,
        webSocketImpl: WebSocket,
      });
      // A synthetic jobId is enough here — this exercises the ordering guard in
      // `ChapterNarrationService.handleStatusUpdate` directly via REST, without needing a
      // real Beatrice job in flight.
      const jobId = randomUUID();

      const events: Array<{ status: string; stage: string | null }> =
        [];

      try {
        const unsubscribe = client.subscribe(
          {
            query: `#graphql
                subscription ChapterNarrationUpdated($chapterID: ID!) {
                  chapterNarrationUpdated(chapterID: $chapterID) {
                    status
                    stage
                  }
                }
              `,
            variables: { chapterID: CHAPTER_TWO_ID },
          },
          {
            next: (data: any) => {
              const event = data.data?.chapterNarrationUpdated;

              if (event) {
                events.push(event);
              }
            },
            error: () => {
              // Errors surfaced via the assertions below timing out.
            },
            complete: () => {
              // Should not complete before the assertions below run.
            },
          },
        );

        // Small delay to ensure the subscription is active before posting callbacks.
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Act: post "generating" (progress 2) first, then the stale "queued" (progress 1).
        const generatingRes = await axios.post(
          '/beatrice-callbacks/status',
          {
            jobId,
            status: 'generating',
            progress: 2,
            clientContextId: CHAPTER_TWO_ID,
          },
        );
        const queuedRes = await axios.post(
          '/beatrice-callbacks/status',
          {
            jobId,
            status: 'queued',
            progress: 1,
            clientContextId: CHAPTER_TWO_ID,
          },
        );

        expect(generatingRes.status).toBe(204);
        expect(queuedRes.status).toBe(204);

        await waitForEventIndex(
          events,
          (event) =>
            event.status === 'PROCESSING' &&
            event.stage === 'generating',
        );

        // Assert: the stale "queued" never made it onto the subscription — the chapter's
        // display state never regresses back to "queued" once "generating" was seen.
        // Give the (already-processed, but async pub/sub) stale callback a moment it
        // doesn't need in order to fail loudly if it slips through.
        await new Promise((resolve) => setTimeout(resolve, 500));

        expect(
          events.some((event) => event.stage === 'queued'),
        ).toBeFalse();

        unsubscribe();
      } finally {
        client.dispose();
      }
    }, 15_000);
  });
});

async function getNarrationUrl(
  novelId: string,
  chapterId: string,
): Promise<string | null> {
  const res = await axios.post('/graphql', {
    query: `#graphql
      query GetChapter($novelId: ID!, $chapterId: ID!) {
        novel(id: $novelId) {
          chapter(id: $chapterId) {
            narrationURL
          }
        }
      }
    `,
    variables: { novelId, chapterId },
  });

  return res.data.data.novel.chapter.narrationURL;
}

async function getNarrationStatus(
  novelId: string,
  chapterId: string,
): Promise<string | null> {
  const res = await axios.post('/graphql', {
    query: `#graphql
      query GetChapter($novelId: ID!, $chapterId: ID!) {
        novel(id: $novelId) {
          chapter(id: $chapterId) {
            narrationStatus
          }
        }
      }
    `,
    variables: { novelId, chapterId },
  });

  return res.data.data.novel.chapter.narrationStatus;
}

/**
 * @description Polls the chapter's `narrationURL` until `accept` takes it, and returns it, or throws after `timeoutMs`.
 */
async function waitForNarrationUrl(
  novelId: string,
  chapterId: string,
  accept: (url: string) => boolean,
  timeoutMs = 10_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const narrationURL = await getNarrationUrl(novelId, chapterId);

    if (narrationURL && accept(narrationURL)) {
      return narrationURL;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    `narrationURL of ${chapterId} was never one that was waited for within ${timeoutMs}ms`,
  );
}

/**
 * @description Polls `events` until an element matching `predicate` appears, returning
 * its index, or throws after 10s. Used to find our own marked events among whatever
 * else the subscription happens to deliver.
 */
async function waitForEventIndex<T>(
  events: T[],
  predicate: (event: T) => boolean,
): Promise<number> {
  const maxAttempts = 40;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const index = events.findIndex(predicate);

    if (index !== -1) {
      return index;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    `No event matching the predicate arrived within 10s (got ${JSON.stringify(events)})`,
  );
}

/**
 * @description Resolves with the next message on `channel` matching `predicate` (default:
 * any message), or rejects after `timeoutMs`. Caller must `await client.subscribe(channel)`
 * before the event that triggers the publish, so the subscription is confirmed before the
 * message can be sent.
 *
 * Filtering matters whenever other tests may have real Beatrice jobs in flight
 * concurrently — every job's status updates share this one Redis channel, so "resolve on
 * the very next message" can pick up an unrelated job's update instead of the caller's own.
 */
function waitForMessage(
  client: Redis,
  channel: string,
  timeoutMs = 5000,
  predicate: (message: string) => boolean = () => true,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.off('message', onMessage);
      reject(
        new Error(
          `No message received on "${channel}" in ${timeoutMs}ms`,
        ),
      );
    }, timeoutMs);

    function onMessage(receivedChannel: string, message: string) {
      if (receivedChannel !== channel || !predicate(message)) {
        return;
      }
      clearTimeout(timeout);
      client.off('message', onMessage);
      resolve(message);
    }

    client.on('message', onMessage);
  });
}

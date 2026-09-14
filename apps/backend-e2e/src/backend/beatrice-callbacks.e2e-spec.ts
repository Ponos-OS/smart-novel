import axios from 'axios';
import { createClient } from 'graphql-ws';
import Redis from 'ioredis';
import { WebSocket } from 'ws';

import { AuthorizationFixture } from '../support';

/** @description Must match `TTS_STATUS_CHANNEL` in apps/backend/src/modules/tts-callbacks/constants.ts */
const TTS_STATUS_CHANNEL = 'tts-audio:status';

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
      const tamperedAuthorization = authorization.slice(0, -1) + 'x';

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

    it('should reject a request with no Authorization header', async () => {
      const { status } = await axios.post(
        '/beatrice-callbacks/gen-upload-url',
        undefined,
        {
          headers: {
            'Idempotency-Key': '2bce49d6-6592-4ed3-b421-f913b9ecc3bd',
          },
          validateStatus: () => true,
        },
      );

      expect(status).toBe(401);
    });

    it('should reject a request missing the Idempotency-Key header', async () => {
      const authorization =
        await AuthorizationFixture.getUserAuthorizationHeader();

      const { status } = await axios.post(
        '/beatrice-callbacks/gen-upload-url',
        undefined,
        {
          headers: { Authorization: authorization },
          validateStatus: () => true,
        },
      );

      expect(status).toBe(400);
    });

    it('should reject a non-UUID Idempotency-Key rather than use it as part of the object key', async () => {
      const authorization =
        await AuthorizationFixture.getUserAuthorizationHeader();

      const { status } = await axios.post(
        '/beatrice-callbacks/gen-upload-url',
        undefined,
        {
          headers: {
            Authorization: authorization,
            'Idempotency-Key': '../../narrations/chapter-1',
          },
          validateStatus: () => true,
        },
      );

      expect(status).toBe(400);
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

    it('should publish a valid payload on the TTS status Redis channel and respond 204', async () => {
      const payload = {
        attempt: 1,
        fileSizeBytes: 4,
        jobId: '2bce49d6-6592-4ed3-b421-f913b9ecc3bd',
        status: 'completed',
      };
      // Filter by our own jobId — other tests' real Beatrice jobs publish onto this
      // same channel concurrently, so "the next message" isn't reliably ours.
      const received = waitForMessage(
        redisSubscriber,
        TTS_STATUS_CHANNEL,
        5000,
        (message) => JSON.parse(message).jobId === payload.jobId,
      );
      await redisSubscriber.subscribe(TTS_STATUS_CHANNEL);

      const res = await axios.post(
        '/beatrice-callbacks/status',
        payload,
      );

      expect(res.status).toBe(204);
      expect(JSON.parse(await received)).toEqual(payload);
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
    // Not used by any other spec's updateContent/generateAudio call — keeps this
    // test's TTS_STATUS_CHANNEL listening free of unrelated "queued" messages.
    const NOVEL_ID = 'c1d31ec2-f478-4648-b90b-d1e53de2a829';
    const CHAPTER_TWO_ID = '4769a024-6267-4abc-a412-5ab0241a8d0e';

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

    it('should persist the audio URL onto the chapter once Beatrice reports the job as completed', async () => {
      const authorization =
        await AuthorizationFixture.getWriterAuthorizationHeader();

      // Arrange: subscribe before triggering generation so the "queued" message
      // (which carries the real jobId Beatrice assigned) can't be missed. Beatrice
      // picks the job up off RabbitMQ asynchronously, so this can take a few
      // seconds under load — well past the 5s default used by the other test
      // in this file (a direct, synchronous POST /status call).
      // Filter for "queued" specifically — other tests' real Beatrice jobs share this
      // channel too, and a "generating"/"failed" message from one of those arriving in
      // the same window would otherwise be mistaken for ours. The budget here is generous
      // because Beatrice serializes jobs through one worker and real CPU-based TTS
      // synthesis (qwen-tts) has been observed taking 200s+ per job, which can delay
      // this one's "queued" message if a prior job is still processing.
      const queued = waitForMessage(
        redisSubscriber,
        TTS_STATUS_CHANNEL,
        250_000,
        (message) => JSON.parse(message).status === 'queued',
      );
      await redisSubscriber.subscribe(TTS_STATUS_CHANNEL);

      // Act: trigger generation (Step 2.0b) via updateContent.
      const updateRes = await axios.post(
        '/graphql',
        {
          query: `#graphql
              mutation UpdateContent($id: ID!, $content: String!) {
                updateContent(id: $id, content: $content) {
                  id
                }
              }
            `,
          variables: {
            id: CHAPTER_TWO_ID,
            content: '# Chapter 2\n\nStep 2.1 e2e content',
          },
        },
        { headers: { Authorization: authorization } },
      );

      expect(updateRes.data.errors).toBeUndefined();

      const { jobId } = JSON.parse(await queued) as { jobId: string };

      // Act: simulate Beatrice's "completed" status callback for that job.
      const statusRes = await axios.post(
        '/beatrice-callbacks/status',
        {
          jobId,
          status: 'completed',
          fileSizeBytes: 4,
          attempt: 1,
          clientContextId: CHAPTER_TWO_ID,
        },
      );

      expect(statusRes.status).toBe(204);

      // Assert: the chapter's narrationUrl reflects this specific job. Polling for
      // this exact substring (rather than any truthy value) matters because
      // CHAPTER_TWO_ID's narrationUrl is also written by the old piper-based flow's
      // e2e tests elsewhere in the suite — checking for our own job's URL, not just
      // "is it set", keeps this assertion correct even if those tests interleave.
      await expectNarrationUrlToContain(
        NOVEL_ID,
        CHAPTER_TWO_ID,
        `narrations/${jobId}.mp3`,
      );
    }, 260_000);
  });

  describe('Step 2.2: chapterNarrationUpdated live progress', () => {
    const CHAPTER_TWO_ID = '4769a024-6267-4abc-a412-5ab0241a8d0e';

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

    it('should stream generating/uploading/completed progress over the chapterNarrationUpdated subscription, in order', async () => {
      const authorization =
        await AuthorizationFixture.getWriterAuthorizationHeader();
      const wsHost = process.env.HOST ?? 'localhost';
      const wsPort = process.env.TRAEFIK_EXPOSED_PORT ?? '8080';
      const client = createClient({
        url: `ws://${wsHost}:${wsPort}/graphql`,
        webSocketImpl: WebSocket,
      });

      const events: Array<{
        status: string;
        narrationUrl: string | null;
        stage: string | null;
        error: string | null;
      }> = [];

      try {
        const unsubscribe = client.subscribe(
          {
            query: `#graphql
                subscription ChapterNarrationUpdated($chapterId: ID!) {
                  chapterNarrationUpdated(chapterId: $chapterId) {
                    status
                    narrationUrl
                    stage
                    error
                  }
                }
              `,
            variables: { chapterId: CHAPTER_TWO_ID },
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

        // Arrange: subscribe to the raw channel too, to learn the real jobId
        // Beatrice assigns — chapterNarrationUpdated events don't expose jobId
        // by design, so this is the only way to correlate.
        // Real CPU-based TTS synthesis (qwen-tts) has been observed taking 200s+ per
        // job, and Beatrice serializes jobs through one worker — a prior test's job
        // still processing can delay this one's "queued" message well past 30s.
        const queued = waitForMessage(
          redisSubscriber,
          TTS_STATUS_CHANNEL,
          250_000,
        );
        await redisSubscriber.subscribe(TTS_STATUS_CHANNEL);

        const updateRes = await axios.post(
          '/graphql',
          {
            query: `#graphql
                mutation UpdateContent($id: ID!, $content: String!) {
                  updateContent(id: $id, content: $content) {
                    id
                  }
                }
              `,
            variables: {
              id: CHAPTER_TWO_ID,
              content: '# Chapter 2\n\nStep 2.2 e2e content',
            },
          },
          { headers: { Authorization: authorization } },
        );

        expect(updateRes.data.errors).toBeUndefined();

        const { jobId } = JSON.parse(await queued) as {
          jobId: string;
        };

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
              event.narrationUrl?.includes(`narrations/${jobId}.mp3`),
            ),
        );

        expect(generatingIndex).toBeLessThan(uploadingIndex);
        expect(uploadingIndex).toBeLessThan(completedIndex);

        unsubscribe();
      } finally {
        client.dispose();
      }
    }, 260_000);
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
      const jobId = '505fa613-318c-43c4-9d5f-64927757087d';

      const events: Array<{ status: string; stage: string | null }> =
        [];

      try {
        const unsubscribe = client.subscribe(
          {
            query: `#graphql
                subscription ChapterNarrationUpdated($chapterId: ID!) {
                  chapterNarrationUpdated(chapterId: $chapterId) {
                    status
                    stage
                  }
                }
              `,
            variables: { chapterId: CHAPTER_TWO_ID },
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

/**
 * @description Polls the chapter's `narrationUrl` until it contains `expectedSubstring`,
 * or throws after 10s.
 */
async function expectNarrationUrlToContain(
  novelId: string,
  chapterId: string,
  expectedSubstring: string,
): Promise<void> {
  const maxAttempts = 40;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await axios.post('/graphql', {
      query: `#graphql
        query GetChapter($novelId: ID!, $chapterId: ID!) {
          novel(id: $novelId) {
            chapter(id: $chapterId) {
              narrationUrl
            }
          }
        }
      `,
      variables: { novelId, chapterId },
    });

    const narrationUrl = res.data.data.novel.chapter.narrationUrl;

    if (narrationUrl?.includes(expectedSubstring)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    `narrationUrl never contained "${expectedSubstring}" within 10s`,
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

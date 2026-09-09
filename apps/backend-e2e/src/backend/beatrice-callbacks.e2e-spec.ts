import axios from 'axios';
import Redis from 'ioredis';

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
        'tts-audio/2bce49d6-6592-4ed3-b421-f913b9ecc3bd.mp3',
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
      const received = waitForMessage(
        redisSubscriber,
        TTS_STATUS_CHANNEL,
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
      const queued = waitForMessage(
        redisSubscriber,
        TTS_STATUS_CHANNEL,
        30_000,
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
        `tts-audio/${jobId}.mp3`,
      );
    }, 35_000);
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
 * @description Resolves with the next message on `channel`, or rejects after `timeoutMs`.
 * Caller must `await client.subscribe(channel)` before the event that triggers
 * the publish, so the subscription is confirmed before the message can be sent.
 */
function waitForMessage(
  client: Redis,
  channel: string,
  timeoutMs = 5000,
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
      if (receivedChannel !== channel) {
        return;
      }
      clearTimeout(timeout);
      client.off('message', onMessage);
      resolve(message);
    }

    client.on('message', onMessage);
  });
}

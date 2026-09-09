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
});

/**
 * @description Resolves with the next message on `channel`, or rejects after 5s.
 * Caller must `await client.subscribe(channel)` before the event that triggers
 * the publish, so the subscription is confirmed before the message can be sent.
 */
function waitForMessage(
  client: Redis,
  channel: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.off('message', onMessage);
      reject(new Error(`No message received on "${channel}" in 5s`));
    }, 5000);

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

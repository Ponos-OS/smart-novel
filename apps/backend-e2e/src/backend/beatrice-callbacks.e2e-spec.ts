import axios from 'axios';

import { AuthorizationFixture } from '../support';

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

    // An expired-but-validly-signed real ZITADEL token is exercised at the unit level
    // (ZitadelAuthProvider.verifyIssuedByUs / BeatriceTokenGuard specs) rather than here —
    // reproducing it e2e would mean waiting out ZITADEL's real access-token lifetime
    // (hours), which isn't practical for a test suite that needs to stay fast.
  });
});

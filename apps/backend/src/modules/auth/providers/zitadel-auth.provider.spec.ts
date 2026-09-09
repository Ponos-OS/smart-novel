import axios from 'axios';
import { createLocalJWKSet, errors, jwtVerify } from 'jose';
import { CustomLoggerService } from 'nestjs-backend-common';

import { RedisService } from '../../redis';
import { AuthModuleOptions } from '../auth.module-definition';
import { ZitadelUserInfoResponse } from '../interfaces';
import { ZitadelAuthProvider } from './zitadel-auth.provider';

vi.mock('axios');
vi.mock('jose', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jose')>();

  return {
    jwtVerify: vi.fn(),
    createLocalJWKSet: vi.fn(),
    errors: actual.errors,
  };
});

describe(ZitadelAuthProvider.name, () => {
  let uut: ZitadelAuthProvider;
  let options: AuthModuleOptions;
  let logger: CustomLoggerService;
  let redisService: RedisService;

  beforeEach(() => {
    vi.clearAllMocks();
    options = {
      issuerUrl: 'http://localhost:8080',
      issuerInternalUrl: 'http://traefik:80',
      domain: 'localhost',
      callbackUrl: 'http://localhost:3000/auth/callback',
      postLogoutUrl: 'http://localhost:3000',
      sessionSecret: 'a-very-long-session-secret-at-least-32-chars!',
      sessionDuration: 3600,
    } as AuthModuleOptions;
    logger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      verbose: vi.fn(),
    } as any;
    redisService = {
      get: vi.fn(),
      set: vi.fn(),
    } as any;

    uut = new ZitadelAuthProvider(options, logger, redisService);
  });

  describe('onModuleInit', () => {
    it('should discover OIDC config and create local JWKS on init', async () => {
      const mockJwks = vi.fn();
      vi.mocked(createLocalJWKSet).mockReturnValue(mockJwks as any);
      vi.mocked(axios.get)
        .mockResolvedValueOnce({
          data: {
            issuer: 'http://traefik:80',
            jwks_uri: 'http://localhost:8080/oauth/v2/keys',
            userinfo_endpoint:
              'http://localhost:8080/oidc/v1/userinfo',
          },
        })
        .mockResolvedValueOnce({
          data: { keys: [{ kty: 'RSA', kid: 'key-1' }] },
        });

      await uut.onModuleInit();

      expect(axios.get).toHaveBeenCalledWith(
        'http://traefik/.well-known/openid-configuration',
      );
      expect(axios.get).toHaveBeenCalledWith(
        'http://traefik/oauth/v2/keys',
      );
      expect(createLocalJWKSet).toHaveBeenCalledWith({
        keys: [{ kty: 'RSA', kid: 'key-1' }],
      });
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('OIDC discovery complete'),
      );
    });

    it('should use issuerUrl as base when issuerInternalUrl is not provided', async () => {
      options.issuerInternalUrl = undefined;
      options.issuerUrl = 'http://internal-zitadel:8080';
      uut = new ZitadelAuthProvider(options, logger, redisService);
      const mockJwks = vi.fn();
      vi.mocked(createLocalJWKSet).mockReturnValue(mockJwks as any);
      vi.mocked(axios.get)
        .mockResolvedValueOnce({
          data: {
            issuer: 'http://internal-zitadel:8080',
            jwks_uri: 'http://internal-zitadel:8080/oauth/v2/keys',
            userinfo_endpoint:
              'http://internal-zitadel:8080/oidc/v1/userinfo',
          },
        })
        .mockResolvedValueOnce({
          data: { keys: [{ kty: 'RSA', kid: 'key-1' }] },
        });

      await uut.onModuleInit();

      expect(axios.get).toHaveBeenCalledWith(
        'http://internal-zitadel:8080/.well-known/openid-configuration',
      );
    });
  });

  describe('validateToken', () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      const mockJwks = vi.fn();
      vi.mocked(createLocalJWKSet).mockReturnValue(mockJwks as any);
      vi.mocked(axios.get)
        .mockResolvedValueOnce({
          data: {
            issuer: 'http://traefik:80',
            jwks_uri: 'http://localhost:8080/oauth/v2/keys',
            userinfo_endpoint:
              'http://localhost:8080/oidc/v1/userinfo',
          },
        })
        .mockResolvedValueOnce({
          data: { keys: [{ kty: 'RSA', kid: 'key-1' }] },
        });
      await uut.onModuleInit();
    });

    it('should validate a token and return a normalized user with roles from userinfo', async () => {
      const { accessToken, sub, userInfoResponse } = getTestData();
      vi.mocked(jwtVerify).mockResolvedValue({
        payload: { sub, iss: 'http://localhost:8080' },
        protectedHeader: { alg: 'RS256' },
      } as any);
      vi.mocked(redisService.get).mockResolvedValue(null);
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: userInfoResponse,
      });
      vi.mocked(redisService.set).mockResolvedValue(true);

      const result = await uut.validateToken(accessToken);

      expect(jwtVerify).toHaveBeenCalledWith(
        accessToken,
        expect.any(Function),
        { issuer: 'http://localhost:8080' },
      );
      expect(result).toEqual({
        sub,
        name: 'Admin User',
        preferredUsername: 'admin@smart-novel.localhost',
        email: 'admin@smart-novel.localhost',
        emailVerified: true,
        orgId: '364554362682343426',
        roles: ['admin'],
        metadata: { theme: 'dark' },
      });
    });

    it('should return cached userinfo from Redis when available', async () => {
      const { accessToken, sub, userInfoResponse } = getTestData();
      vi.mocked(jwtVerify).mockResolvedValue({
        payload: { sub, iss: 'http://localhost:8080' },
        protectedHeader: { alg: 'RS256' },
      } as any);
      vi.mocked(redisService.get).mockResolvedValue(
        JSON.stringify(userInfoResponse),
      );

      await uut.validateToken(accessToken);

      expect(redisService.get).toHaveBeenCalledWith(
        'auth:userinfo:23ec8b2cd40d2daeeda445fbadf43282a7ac17983e507101fdfe7425fd308bab',
      );
    });

    it('should cache userinfo in Redis after fetching from the endpoint', async () => {
      const { accessToken, sub, userInfoResponse } = getTestData();
      vi.mocked(jwtVerify).mockResolvedValue({
        payload: { sub, iss: 'http://localhost:8080' },
        protectedHeader: { alg: 'RS256' },
      } as any);
      vi.mocked(redisService.get).mockResolvedValue(null);
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: userInfoResponse,
      });
      vi.mocked(redisService.set).mockResolvedValue(true);

      await uut.validateToken(accessToken);

      expect(redisService.set).toHaveBeenCalledWith(
        'auth:userinfo:23ec8b2cd40d2daeeda445fbadf43282a7ac17983e507101fdfe7425fd308bab',
        JSON.stringify(userInfoResponse),
        60,
      );
    });

    it('should fall through to HTTP when Redis get fails', async () => {
      const { accessToken, sub, userInfoResponse } = getTestData();
      vi.mocked(jwtVerify).mockResolvedValue({
        payload: { sub, iss: 'http://localhost:8080' },
        protectedHeader: { alg: 'RS256' },
      } as any);
      vi.mocked(redisService.get).mockRejectedValue(
        new Error('Redis connection lost'),
      );
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: userInfoResponse,
      });
      vi.mocked(redisService.set).mockResolvedValue(true);

      await uut.validateToken(accessToken);

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/oidc/v1/userinfo'),
        expect.objectContaining({
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      );
    });

    it('should still return user when Redis set fails', async () => {
      const { accessToken, sub, userInfoResponse } = getTestData();
      vi.mocked(jwtVerify).mockResolvedValue({
        payload: { sub, iss: 'http://localhost:8080' },
        protectedHeader: { alg: 'RS256' },
      } as any);
      vi.mocked(redisService.get).mockResolvedValue(null);
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: userInfoResponse,
      });
      vi.mocked(redisService.set).mockRejectedValue(
        new Error('Redis write failure'),
      );

      const result = await uut.validateToken(accessToken);

      expect(result.sub).toBe(sub);
      expect(result.roles).toEqual(['admin']);
    });

    it('should fetch roles via fallback API when userinfo has no roles', async () => {
      const { accessToken, sub } = getTestData();
      const userInfoWithoutRoles: ZitadelUserInfoResponse = {
        sub,
        name: 'Service Account',
        preferred_username: 'service@smart-novel.localhost',
        email: 'service@smart-novel.localhost',
        email_verified: true,
      };
      vi.mocked(jwtVerify).mockResolvedValue({
        payload: { sub, iss: 'http://localhost:8080' },
        protectedHeader: { alg: 'RS256' },
      } as any);
      vi.mocked(redisService.get).mockResolvedValue(null);
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: userInfoWithoutRoles,
      });
      vi.mocked(redisService.set).mockResolvedValue(true);
      vi.mocked(axios.post).mockResolvedValueOnce({
        data: {
          authorizations: [
            { roleKeys: ['admin', 'reader'] },
            { roleKeys: ['reader'] },
          ],
        },
      });

      const result = await uut.validateToken(accessToken);

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining(
          'zitadel.authorization.v2beta.AuthorizationService/ListAuthorizations',
        ),
        { pagination: { limit: 100, asc: true } },
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${accessToken}`,
          }),
        }),
      );
      expect(result.roles).toEqual(
        expect.arrayContaining(['admin', 'reader']),
      );
      expect(result.roles).toHaveLength(2);
    });

    it('should deduplicate roles from the fallback API response', async () => {
      const { accessToken, sub } = getTestData();
      const userInfoWithoutRoles: ZitadelUserInfoResponse = {
        sub,
        name: 'Service Account',
      };
      vi.mocked(jwtVerify).mockResolvedValue({
        payload: { sub, iss: 'http://localhost:8080' },
        protectedHeader: { alg: 'RS256' },
      } as any);
      vi.mocked(redisService.get).mockResolvedValue(null);
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: userInfoWithoutRoles,
      });
      vi.mocked(redisService.set).mockResolvedValue(true);
      vi.mocked(axios.post).mockResolvedValueOnce({
        data: {
          result: [
            { roles: ['editor', 'viewer'] },
            { roles: ['editor'] },
          ],
        },
      });

      const result = await uut.validateToken(accessToken);

      expect(result.roles).toEqual(
        expect.arrayContaining(['editor', 'viewer']),
      );
      expect(result.roles).toHaveLength(2);
    });

    it('should return empty roles when the fallback API call fails', async () => {
      const { accessToken, sub } = getTestData();
      const userInfoWithoutRoles: ZitadelUserInfoResponse = {
        sub,
        name: 'Service Account',
      };
      vi.mocked(jwtVerify).mockResolvedValue({
        payload: { sub, iss: 'http://localhost:8080' },
        protectedHeader: { alg: 'RS256' },
      } as any);
      vi.mocked(redisService.get).mockResolvedValue(null);
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: userInfoWithoutRoles,
      });
      vi.mocked(redisService.set).mockResolvedValue(true);
      vi.mocked(axios.post).mockRejectedValueOnce(
        new Error('Network error'),
      );

      const result = await uut.validateToken(accessToken);

      expect(result.roles).toEqual([]);
    });

    it('should retry OIDC discovery when JWKS was not initialized at startup', async () => {
      const { accessToken, sub, userInfoResponse } = getTestData();
      vi.mocked(axios.get).mockRejectedValueOnce(
        new Error('ECONNREFUSED'),
      );
      await uut.onModuleInit();
      vi.clearAllMocks();

      const mockJwks = vi.fn();
      vi.mocked(createLocalJWKSet).mockReturnValue(mockJwks as any);
      vi.mocked(axios.get)
        .mockResolvedValueOnce({
          data: {
            issuer: 'http://traefik:80',
            jwks_uri: 'http://localhost:8080/oauth/v2/keys',
            userinfo_endpoint:
              'http://localhost:8080/oidc/v1/userinfo',
          },
        })
        .mockResolvedValueOnce({
          data: { keys: [{ kty: 'RSA', kid: 'key-1' }] },
        })
        .mockResolvedValueOnce({
          data: userInfoResponse,
        });
      vi.mocked(jwtVerify).mockResolvedValue({
        payload: { sub, iss: 'http://localhost:8080' },
        protectedHeader: { alg: 'RS256' },
      } as any);
      vi.mocked(redisService.get).mockResolvedValue(null);
      vi.mocked(redisService.set).mockResolvedValue(true);

      const result = await uut.validateToken(accessToken);

      expect(result.sub).toBe(sub);
    });

    it('should throw when JWKS cannot be obtained even after lazy retry', async () => {
      const { accessToken } = getTestData();
      const freshProvider = new ZitadelAuthProvider(
        options,
        logger,
        redisService,
      );
      vi.mocked(axios.get).mockReset();
      vi.mocked(axios.get).mockRejectedValue(
        new Error('ECONNREFUSED'),
      );
      await freshProvider.onModuleInit();

      await expect(
        freshProvider.validateToken(accessToken),
      ).rejects.toThrow(
        'OIDC provider is not available. Could not discover JWKS.',
      );
    });

    it('should normalize missing optional fields to safe defaults', async () => {
      const { accessToken, sub } = getTestData();
      const minimalUserInfo: ZitadelUserInfoResponse = {
        sub,
      };
      vi.mocked(jwtVerify).mockResolvedValue({
        payload: { sub, iss: 'http://localhost:8080' },
        protectedHeader: { alg: 'RS256' },
      } as any);
      vi.mocked(redisService.get).mockResolvedValue(null);
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: minimalUserInfo,
      });
      vi.mocked(redisService.set).mockResolvedValue(true);
      vi.mocked(axios.post).mockResolvedValueOnce({
        data: {},
      });

      const result = await uut.validateToken(accessToken);

      expect(result).toEqual({
        sub,
        name: '',
        preferredUsername: '',
        email: '',
        emailVerified: false,
        orgId: undefined,
        roles: [],
        metadata: {},
      });
    });
  });

  describe('verifyIssuedByUs', () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      const mockJwks = vi.fn();
      vi.mocked(createLocalJWKSet).mockReturnValue(mockJwks as any);
      vi.mocked(axios.get)
        .mockResolvedValueOnce({
          data: {
            issuer: 'http://traefik:80',
            jwks_uri: 'http://localhost:8080/oauth/v2/keys',
            userinfo_endpoint:
              'http://localhost:8080/oidc/v1/userinfo',
          },
        })
        .mockResolvedValueOnce({
          data: { keys: [{ kty: 'RSA', kid: 'key-1' }] },
        });
      await uut.onModuleInit();
    });

    it('should resolve for a valid, unexpired token', async () => {
      const { accessToken } = getTestData();
      vi.mocked(jwtVerify).mockResolvedValue({
        payload: { sub: 'irrelevant' },
        protectedHeader: { alg: 'RS256' },
      } as any);

      await expect(
        uut.verifyIssuedByUs(accessToken),
      ).resolves.toBeUndefined();

      expect(jwtVerify).toHaveBeenCalledWith(
        accessToken,
        expect.any(Function),
        { issuer: 'http://localhost:8080' },
      );
    });

    it('should resolve for a token with a valid signature that has expired', async () => {
      const { accessToken } = getTestData();
      vi.mocked(jwtVerify).mockRejectedValue(
        new errors.JWTExpired(
          '"exp" claim timestamp check failed',
          { sub: 'irrelevant' },
          'exp',
          'check_failed',
        ),
      );

      await expect(
        uut.verifyIssuedByUs(accessToken),
      ).resolves.toBeUndefined();
    });

    it('should reject a token with a tampered signature', async () => {
      const { accessToken } = getTestData();
      vi.mocked(jwtVerify).mockRejectedValue(
        new errors.JWSSignatureVerificationFailed(
          'signature verification failed',
        ),
      );

      await expect(uut.verifyIssuedByUs(accessToken)).rejects.toThrow(
        errors.JWSSignatureVerificationFailed,
      );
    });

    it('should reject a token issued by a different issuer', async () => {
      const { accessToken } = getTestData();
      vi.mocked(jwtVerify).mockRejectedValue(
        new errors.JWTClaimValidationFailed(
          'unexpected "iss" claim value',
          { sub: 'irrelevant' },
          'iss',
          'check_failed',
        ),
      );

      await expect(uut.verifyIssuedByUs(accessToken)).rejects.toThrow(
        errors.JWTClaimValidationFailed,
      );
    });

    it('should throw when JWKS cannot be obtained even after lazy retry', async () => {
      const { accessToken } = getTestData();
      const freshProvider = new ZitadelAuthProvider(
        options,
        logger,
        redisService,
      );
      vi.mocked(axios.get).mockReset();
      vi.mocked(axios.get).mockRejectedValue(
        new Error('ECONNREFUSED'),
      );
      await freshProvider.onModuleInit();

      await expect(
        freshProvider.verifyIssuedByUs(accessToken),
      ).rejects.toThrow(
        'OIDC provider is not available. Could not discover JWKS.',
      );
    });
  });
});

function getTestData() {
  const accessToken =
    'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzNjQ1NTQzNjI4ODM2NzAwMTgiLCJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjgwODAifQ.stub-signature';
  const sub = '364554362883670018';
  const userInfoResponse: ZitadelUserInfoResponse = {
    sub,
    name: 'Admin User',
    preferred_username: 'admin@smart-novel.localhost',
    email: 'admin@smart-novel.localhost',
    email_verified: true,
    'urn:zitadel:iam:org:id': '364554362682343426',
    'urn:zitadel:iam:org:project:roles': {
      admin: { '364554362682343426': 'smart-novel.localhost' },
    },
    'urn:zitadel:iam:user:metadata': {
      theme: Buffer.from('dark').toString('base64'),
    },
  };

  return { accessToken, sub, userInfoResponse };
}

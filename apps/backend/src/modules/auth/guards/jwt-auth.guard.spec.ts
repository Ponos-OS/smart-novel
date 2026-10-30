import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { CustomLoggerService } from 'nestjs-backend-common';

import type { IAuthProvider, IAuthUser } from '../interfaces';

import { IS_PUBLIC_KEY } from '../decorators';
import { JwtAuthGuard } from './jwt-auth.guard';

vi.mock('@nestjs/graphql', () => ({
  GqlExecutionContext: {
    create: vi.fn(),
  },
}));

describe(JwtAuthGuard.name, () => {
  let uut: JwtAuthGuard;
  let authProvider: IAuthProvider;
  let reflector: Reflector;
  let logger: CustomLoggerService;
  const mockHandler = vi.fn();
  const mockClass = vi.fn();
  const mockExecutionContext = {
    getHandler: () => mockHandler,
    getClass: () => mockClass,
  } as any;

  beforeEach(() => {
    authProvider = {
      validateToken: vi.fn(),
    } as any;

    reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(undefined),
    } as any;

    logger = {
      error: vi.fn(),
    } as any;

    uut = new JwtAuthGuard(authProvider, reflector, logger);
  });

  describe('public routes (@Public)', () => {
    it('should allow access without a token', async () => {
      mockReflectorMetadata(IS_PUBLIC_KEY, true, reflector);
      mockGqlContext({});

      const result = await uut.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(authProvider.validateToken).not.toHaveBeenCalled();
    });

    it('should populate req.user when a valid token is present', async () => {
      mockReflectorMetadata(IS_PUBLIC_KEY, true, reflector);
      const req = mockGqlContext({
        authorization: 'Bearer valid-token',
      });
      const user = buildUser();
      vi.mocked(authProvider.validateToken).mockResolvedValue(user);

      const result = await uut.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(authProvider.validateToken).toHaveBeenCalledWith(
        'valid-token',
      );
      expect(req.user).toBe(user);
    });

    it('should silently ignore an invalid token and still allow access', async () => {
      mockReflectorMetadata(IS_PUBLIC_KEY, true, reflector);
      const req = mockGqlContext({
        authorization: 'Bearer bad-token',
      });
      vi.mocked(authProvider.validateToken).mockRejectedValue(
        new Error('Invalid token'),
      );

      const result = await uut.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(req.user).toBeNull();
    });
  });

  describe('protected routes', () => {
    it('should throw UnauthorizedException when no token is provided', async () => {
      mockGqlContext({});

      await expect(
        uut.canActivate(mockExecutionContext),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should populate req.user and allow access with a valid token', async () => {
      const req = mockGqlContext({
        authorization: 'Bearer valid-token',
      });
      const user = buildUser();
      vi.mocked(authProvider.validateToken).mockResolvedValue(user);

      const result = await uut.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(req.user).toBe(user);
    });

    it('should throw UnauthorizedException when token validation fails', async () => {
      mockGqlContext({ authorization: 'Bearer bad-token' });
      vi.mocked(authProvider.validateToken).mockRejectedValue(
        new Error('Expired'),
      );

      await expect(
        uut.canActivate(mockExecutionContext),
      ).rejects.toThrow(UnauthorizedException);
      expect(logger.error).toHaveBeenCalled();
    });
  });
});

function mockReflectorMetadata(
  key: string | symbol,
  value: unknown,
  reflector: Reflector,
) {
  vi.mocked(reflector.getAllAndOverride).mockImplementation(((
    metadataKey: unknown,
  ) => {
    if (metadataKey === key) {
      return value;
    }
    return undefined;
  }) as typeof reflector.getAllAndOverride);
}

function mockGqlContext(headers: Record<string, string> = {}): {
  user?: IAuthUser;
} {
  const req: { headers: Record<string, string>; user?: IAuthUser } = {
    headers,
  };
  vi.mocked(GqlExecutionContext.create).mockReturnValue({
    getContext: () => ({ req }),
  } as any);
  return req;
}

function buildUser(overrides: Partial<IAuthUser> = {}): IAuthUser {
  return {
    sub: 'user-123',
    name: 'Test User',
    givenName: 'Test',
    familyName: 'Testi',
    preferredUsername: 'testuser',
    email: 'test@example.com',
    emailVerified: true,
    roles: ['user'],
    metadata: {},
    ...overrides,
  };
}

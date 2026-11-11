import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Role } from '@smart-novel/shared';
import { CustomLoggerService } from 'nestjs-backend-common';

import type { IAuthUser } from '../interfaces';

import { IS_PUBLIC_KEY, REQUIRE_ROLE_KEY } from '../decorators';
import { RolesGuard } from './roles.guard';

vi.mock('@nestjs/graphql', () => ({
  GqlExecutionContext: {
    create: vi.fn(),
  },
}));

describe(RolesGuard.name, () => {
  let uut: RolesGuard;
  let reflector: Reflector;
  let logger: CustomLoggerService;

  const mockHandler = vi.fn();
  const mockClass = vi.fn();
  const mockExecutionContext = {
    getHandler: () => mockHandler,
    getClass: () => mockClass,
  } as unknown as ExecutionContext;

  function mockReflectorMetadata(
    key: string | symbol,
    value: unknown,
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

  function mockGqlContext(user?: IAuthUser) {
    vi.mocked(GqlExecutionContext.create).mockReturnValue({
      getContext: () => ({
        req: { user },
      }),
    } as any);
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

  beforeEach(() => {
    reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(undefined),
    } as any;

    logger = {
      warn: vi.fn(),
    } as any;

    uut = new RolesGuard(reflector, logger);
  });

  it('should allow access when @Public() is set', () => {
    mockReflectorMetadata(IS_PUBLIC_KEY, true);

    const result = uut.canActivate(mockExecutionContext);

    expect(result).toBe(true);
  });

  it('should allow access when no @RequireRole() metadata is present', () => {
    const result = uut.canActivate(mockExecutionContext);

    expect(result).toBe(true);
  });

  it('should throw ForbiddenException when no user is on the request', () => {
    mockReflectorMetadata(REQUIRE_ROLE_KEY, Role.writer);
    mockGqlContext(undefined);

    expect(() => uut.canActivate(mockExecutionContext)).toThrow(
      ForbiddenException,
    );
  });

  it('should allow access when user has the exact required role', () => {
    mockReflectorMetadata(REQUIRE_ROLE_KEY, Role.writer);
    mockGqlContext(buildUser({ roles: ['writer'] }));

    const result = uut.canActivate(mockExecutionContext);

    expect(result).toBe(true);
  });

  it('should allow access when user has a higher role than required', () => {
    mockReflectorMetadata(REQUIRE_ROLE_KEY, Role.writer);
    mockGqlContext(buildUser({ roles: ['admin'] }));

    const result = uut.canActivate(mockExecutionContext);

    expect(result).toBe(true);
  });

  it('should throw ForbiddenException when user has a lower role than required', () => {
    mockReflectorMetadata(REQUIRE_ROLE_KEY, Role.writer);
    mockGqlContext(buildUser({ roles: ['user'] }));

    expect(() => uut.canActivate(mockExecutionContext)).toThrow(
      ForbiddenException,
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Role check denied'),
    );
  });

  it('should allow access when user has multiple roles and one meets the requirement', () => {
    mockReflectorMetadata(REQUIRE_ROLE_KEY, Role.writer);
    mockGqlContext(buildUser({ roles: ['user', 'writer'] }));

    const result = uut.canActivate(mockExecutionContext);

    expect(result).toBe(true);
  });
});

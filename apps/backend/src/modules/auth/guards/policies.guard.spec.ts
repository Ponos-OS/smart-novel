import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { CustomLoggerService } from 'nestjs-backend-common';

import type {
  IAuthorizationProvider,
  IAuthUser,
} from '../interfaces';

import { CHECK_POLICY_KEY, IS_PUBLIC_KEY } from '../decorators';
import { Role } from '../enums';
import { PoliciesGuard } from './policies.guard';

vi.mock('@nestjs/graphql', () => ({
  GqlExecutionContext: {
    create: vi.fn(),
  },
}));

describe(PoliciesGuard.name, () => {
  let uut: PoliciesGuard;
  let reflector: Reflector;
  let authzProvider: IAuthorizationProvider;
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

  beforeEach(() => {
    reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(undefined),
    } as any;

    authzProvider = {
      isAllowed: vi.fn().mockResolvedValue(true),
    };

    logger = {
      warn: vi.fn(),
    } as any;

    uut = new PoliciesGuard(authzProvider, reflector, logger);
  });

  it('should allow access when @Public() is set', async () => {
    mockReflectorMetadata(IS_PUBLIC_KEY, true);

    const result = await uut.canActivate(mockExecutionContext);

    expect(result).toBe(true);
    expect(authzProvider.isAllowed).not.toHaveBeenCalled();
  });

  it('should allow access when no @CheckPolicy() metadata is present', async () => {
    const result = await uut.canActivate(mockExecutionContext);

    expect(result).toBe(true);
    expect(authzProvider.isAllowed).not.toHaveBeenCalled();
  });

  it('should throw ForbiddenException when no user is on the request', async () => {
    mockReflectorMetadata(CHECK_POLICY_KEY, {
      resource: 'chapter',
      action: 'update',
    });
    mockGqlContext({ id: 'chapter-1' }, undefined);

    await expect(
      uut.canActivate(mockExecutionContext),
    ).rejects.toThrow(ForbiddenException);
  });

  it("should resolve resourceId from a GQL arg literally named 'id' and pass no resourceAttributes when there is no extractor", async () => {
    mockReflectorMetadata(CHECK_POLICY_KEY, {
      resource: 'chapter',
      action: 'update',
    });
    mockGqlContext(
      { id: 'chapter-1', content: 'irrelevant' },
      buildUser(),
    );

    await uut.canActivate(mockExecutionContext);

    expect(authzProvider.isAllowed).toHaveBeenCalledExactlyOnceWith({
      principal: expect.objectContaining({
        sub: '234980127461293841',
      }),
      resource: 'chapter',
      resourceId: 'chapter-1',
      action: 'update',
      resourceAttributes: {},
    });
  });

  it("should default resourceId to 'unknown' when there is no 'id' arg", async () => {
    mockReflectorMetadata(CHECK_POLICY_KEY, {
      resource: 'chapter',
      action: 'create',
    });
    mockGqlContext({ novelId: 'novel-1' }, buildUser());

    await uut.canActivate(mockExecutionContext);

    expect(authzProvider.isAllowed).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ resourceId: 'unknown' }),
    );
  });

  it('should populate resourceAttributes from extractResourceAttributes only, ignoring other args', async () => {
    const extractResourceAttributes = vi.fn().mockReturnValue({
      novelId: 'novel-1',
    });
    mockReflectorMetadata(CHECK_POLICY_KEY, {
      resource: 'chapter',
      action: 'create',
      extractResourceAttributes,
    });
    const args = { novelId: 'novel-1', input: { title: 'A title' } };
    mockGqlContext(args, buildUser());

    await uut.canActivate(mockExecutionContext);

    expect(extractResourceAttributes).toHaveBeenCalledExactlyOnceWith(
      args,
    );
    expect(authzProvider.isAllowed).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        resourceAttributes: { novelId: 'novel-1' },
      }),
    );
  });

  it('should throw ForbiddenException with a descriptive message when the provider denies access', async () => {
    mockReflectorMetadata(CHECK_POLICY_KEY, {
      resource: 'chapter',
      action: 'create',
    });
    mockGqlContext({ novelId: 'novel-1' }, buildUser());
    vi.mocked(authzProvider.isAllowed).mockResolvedValue(false);

    await expect(
      uut.canActivate(mockExecutionContext),
    ).rejects.toThrow(
      'You do not have permission to create this chapter',
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Access denied'),
    );
  });

  it('should allow access when the provider grants it', async () => {
    mockReflectorMetadata(CHECK_POLICY_KEY, {
      resource: 'chapter',
      action: 'create',
    });
    mockGqlContext({ novelId: 'novel-1' }, buildUser());

    const result = await uut.canActivate(mockExecutionContext);

    expect(result).toBe(true);
  });
});

function buildUser(overrides: Partial<IAuthUser> = {}): IAuthUser {
  return {
    sub: '234980127461293841',
    name: 'Test User',
    preferredUsername: 'testuser',
    email: 'test@example.com',
    emailVerified: true,
    roles: [Role.writer],
    metadata: {},
    ...overrides,
  };
}

function mockGqlContext(
  args: Record<string, unknown>,
  user?: IAuthUser,
) {
  vi.mocked(GqlExecutionContext.create).mockReturnValue({
    getContext: () => ({ req: { user } }),
    getArgs: () => args,
  } as any);
}

import { CustomLoggerService } from 'nestjs-backend-common';

import type { IAuthUser } from '../interfaces';
import type { ChapterPolicy, NovelPolicy } from '../policies';

import { RbacAuthorizationProvider } from './rbac-authorization.provider';

describe(RbacAuthorizationProvider.name, () => {
  let uut: RbacAuthorizationProvider;
  let novelPolicy: NovelPolicy;
  let chapterPolicy: ChapterPolicy;
  let logger: CustomLoggerService;

  const principal: IAuthUser = {
    sub: 'user-1',
    name: 'Test User',
    preferredUsername: 'testuser',
    email: 'test@example.com',
    emailVerified: true,
    roles: ['writer'],
    metadata: {},
  };

  beforeEach(() => {
    novelPolicy = {
      isAllowed: vi.fn().mockResolvedValue(true),
    } as any;
    chapterPolicy = {
      isAllowed: vi.fn().mockResolvedValue(true),
    } as any;
    logger = { log: vi.fn(), debug: vi.fn(), warn: vi.fn() } as any;

    uut = new RbacAuthorizationProvider(
      logger,
      novelPolicy,
      chapterPolicy,
    );
  });

  it("should delegate a 'novel' resource check to NovelPolicy", async () => {
    const result = await uut.isAllowed({
      principal,
      resource: 'novel',
      resourceId: '4754496a-ccb4-4a6b-805d-809a6cea97c8',
      action: 'update',
    });

    expect(result).toBeTrue();
    expect(novelPolicy.isAllowed).toHaveBeenCalledExactlyOnceWith({
      userId: 'user-1',
      userRoles: ['writer'],
      resourceId: '4754496a-ccb4-4a6b-805d-809a6cea97c8',
      action: 'update',
    });
    expect(chapterPolicy.isAllowed).not.toHaveBeenCalled();
  });

  it("should delegate a 'chapter' resource check to ChapterPolicy", async () => {
    const result = await uut.isAllowed({
      principal,
      resource: 'chapter',
      resourceId: 'unknown',
      action: 'create',
    });

    expect(result).toBeTrue();
    expect(chapterPolicy.isAllowed).toHaveBeenCalledExactlyOnceWith({
      userId: 'user-1',
      userRoles: ['writer'],
      resourceId: 'unknown',
      action: 'create',
    });
    expect(novelPolicy.isAllowed).not.toHaveBeenCalled();
  });

  it('should propagate a denial from the delegated policy', async () => {
    vi.mocked(chapterPolicy.isAllowed).mockResolvedValue(false);

    const result = await uut.isAllowed({
      principal,
      resource: 'chapter',
      resourceId: 'chapter-1',
      action: 'update',
    });

    expect(result).toBeFalse();
  });

  it('should deny and log when the resource type has no registered policy', async () => {
    const result = await uut.isAllowed({
      principal,
      resource: 'nonexistent-resource',
      resourceId: 'unknown',
      action: 'read',
    });

    expect(result).toBeFalse();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('nonexistent-resource'),
    );
    expect(novelPolicy.isAllowed).not.toHaveBeenCalled();
    expect(chapterPolicy.isAllowed).not.toHaveBeenCalled();
  });
});

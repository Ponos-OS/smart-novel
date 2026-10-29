import {
  type ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { PLATFORM_TERMS_NOT_ACCEPTED } from '@smart-novel/shared';

import type { PlatformTermsService } from './platform-terms.service';

import { PlatformTermsGuard } from './platform-terms.guard';

describe(PlatformTermsGuard.name, () => {
  let uut: PlatformTermsGuard;
  let platformTermsService: PlatformTermsService;

  const executionContext = {} as ExecutionContext;

  function givenUser(user: unknown) {
    vi.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => ({ req: { user } }),
    } as any);
  }

  beforeEach(() => {
    platformTermsService = {
      hasAcceptedCurrent: vi.fn(),
    } as any;

    uut = new PlatformTermsGuard(platformTermsService);
  });

  it.each([['writer'], ['admin']])(
    'should let a %s who accepted the terms through',
    async (role) => {
      givenUser({ sub: '260311094522198751', roles: [role] });
      vi.mocked(
        platformTermsService.hasAcceptedCurrent,
      ).mockResolvedValue(true);

      const result = await uut.canActivate(executionContext);

      expect(result).toBeTrue();
    },
  );

  it.each([['writer'], ['admin']])(
    'should block a %s who has not accepted the terms with a typed error',
    async (role) => {
      givenUser({ sub: '260311094522198751', roles: [role] });
      vi.mocked(
        platformTermsService.hasAcceptedCurrent,
      ).mockResolvedValue(false);

      const result = uut.canActivate(executionContext);

      await expect(result).rejects.toMatchObject({
        extensions: {
          code: PLATFORM_TERMS_NOT_ACCEPTED,
          status: 403,
        },
      });
    },
  );

  it('should not ask a plain user', async () => {
    givenUser({ sub: '260311094522198751', roles: ['user'] });

    const result = await uut.canActivate(executionContext);

    expect(result).toBeTrue();
    expect(
      platformTermsService.hasAcceptedCurrent,
    ).not.toHaveBeenCalled();
  });

  it('should refuse a request without a user', async () => {
    givenUser(undefined);

    const result = uut.canActivate(executionContext);

    await expect(result).rejects.toThrow(ForbiddenException);
  });
});

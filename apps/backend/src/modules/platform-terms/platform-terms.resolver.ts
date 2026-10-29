import {
  Args,
  Int,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';

import { CurrentUser, type IAuthUser, Public } from '../auth';
import { PlatformTermsService } from './platform-terms.service';
import { PlatformTerms, PlatformTermsStatus } from './types';

@Resolver()
export class PlatformTermsResolver {
  constructor(
    private readonly platformTermsService: PlatformTermsService,
  ) {}

  @Public()
  @Query(() => PlatformTerms, {
    description: 'The current platform terms',
  })
  platformTerms(): PlatformTerms {
    return this.platformTermsService.getCurrent();
  }

  @Query(() => PlatformTermsStatus, {
    description: 'Whether the caller accepted the current terms',
  })
  async myPlatformTermsStatus(
    @CurrentUser() user: IAuthUser,
  ): Promise<PlatformTermsStatus> {
    return this.platformTermsService.getStatus(user.sub);
  }

  @Mutation(() => PlatformTermsStatus, {
    description:
      'Accept the platform terms. Fails with PLATFORM_TERMS_VERSION_MISMATCH when `version` is not the current one, and is idempotent otherwise.',
  })
  async acceptPlatformTerms(
    @Args('version', {
      type: () => Int,
      description: 'The version the caller read',
    })
    version: number,
    @CurrentUser() user: IAuthUser,
  ): Promise<PlatformTermsStatus> {
    return this.platformTermsService.accept(user.sub, version);
  }
}

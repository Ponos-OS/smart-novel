import {
  Args,
  Int,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { Role } from '@smart-novel/shared';

import {
  CheckPolicy,
  CurrentUser,
  type IAuthUser,
  RequireRole,
} from '../auth';
import {
  LicenseFiltersInput,
  SetDefaultLicenseInput,
} from './inputs';
import { LicenseService } from './services';
import { License, LicenseConnection } from './types';

@Resolver(() => License)
export class LicenseResolver {
  constructor(private readonly licenseService: LicenseService) {}

  @Query(() => License, {
    description: 'The license new novels get when none is chosen',
  })
  async defaultLicense(): Promise<License> {
    return this.licenseService.getDefault();
  }

  @RequireRole(Role.writer)
  @Query(() => LicenseConnection, {
    description:
      'Paginated licenses, newest first, narrowed by `filters.scope` and `filters.search` (the name contains it). An admin gets every license; a writer gets the shared ones and their own licenses and drafts. Without `first` or `last` a page of 20 is returned, at most 100 are allowed.',
  })
  async licensesConnection(
    @CurrentUser() user: IAuthUser,
    @Args('first', { type: () => Int, nullable: true })
    first?: number,
    @Args('last', { type: () => Int, nullable: true }) last?: number,
    @Args('after', { type: () => String, nullable: true })
    after?: string,
    @Args('before', { type: () => String, nullable: true })
    before?: string,
    @Args('filters', {
      type: () => LicenseFiltersInput,
      nullable: true,
    })
    filters?: LicenseFiltersInput,
  ): Promise<LicenseConnection> {
    return this.licenseService.licensesConnection(
      { id: user.sub, isAdmin: user.roles.includes(Role.admin) },
      { first, last, after, before },
      filters,
    );
  }

  @CheckPolicy('license', 'update')
  @Mutation(() => License, {
    description:
      'Admin only. Change the license new novels get; existing novels keep theirs.',
  })
  async setDefaultLicense(
    @Args('input', { type: () => SetDefaultLicenseInput })
    input: SetDefaultLicenseInput,
  ): Promise<License> {
    return this.licenseService.setDefault(input);
  }
}

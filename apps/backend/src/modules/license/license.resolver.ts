import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { CheckPolicy } from '../auth';
import { SetDefaultLicenseInput } from './inputs';
import { LicenseService } from './services';
import { License } from './types';

@Resolver(() => License)
export class LicenseResolver {
  constructor(private readonly licenseService: LicenseService) {}

  @Query(() => License, {
    description: 'The license new novels get when none is chosen',
  })
  async defaultLicense(): Promise<License> {
    return this.licenseService.getDefault();
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

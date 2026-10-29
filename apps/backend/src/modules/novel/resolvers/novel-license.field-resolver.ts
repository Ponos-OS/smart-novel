import { Parent, ResolveField, Resolver } from '@nestjs/graphql';

import { Public } from '../../auth';
import { License, LicenseDataLoader } from '../../license';
import { Novel } from '../types';

@Public()
@Resolver(() => Novel)
export class NovelLicenseFieldResolver {
  constructor(
    private readonly licenseDataLoader: LicenseDataLoader,
  ) {}

  @ResolveField(() => License, {
    description: 'The license the novel is published under',
  })
  license(@Parent() novel: Novel): Promise<License> {
    return this.licenseDataLoader.load(novel.licenseId);
  }
}

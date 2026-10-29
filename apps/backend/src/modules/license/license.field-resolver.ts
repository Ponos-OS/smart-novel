import { Parent, ResolveField, Resolver } from '@nestjs/graphql';

import { Public } from '../auth';
import { CanonicalLicenseCatalog } from '../fithara';
import { License } from './types';

@Public()
@Resolver(() => License)
export class LicenseFieldResolver {
  constructor(
    private readonly canonicalLicenseCatalog: CanonicalLicenseCatalog,
  ) {}

  @ResolveField(() => String, {
    nullable: true,
    description:
      'Link to the authoritative text of the canonical license this is, or was modified from. Null for CUSTOM, or when the registry cannot be reached.',
  })
  async officialUrl(
    @Parent() license: License,
  ): Promise<string | null> {
    if (!license.canonicalId) {
      return null;
    }

    return this.canonicalLicenseCatalog.getOfficialUrl(
      license.canonicalId,
    );
  }
}

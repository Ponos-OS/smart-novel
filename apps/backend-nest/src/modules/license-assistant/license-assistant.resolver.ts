import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Role } from '@smart-novel/shared';

import { CurrentUser, type IAuthUser, RequireRole } from '../auth';
import { RequireAcceptedTerms } from '../platform-terms';
import { DraftLicenseInput } from './inputs';
import { LicenseAssistantService } from './license-assistant.service';
import {
  CanonicalLicense,
  CanonicalLicenseSummary,
  LicenseAssistantTurn,
} from './types';

@RequireRole(Role.writer)
@Resolver()
export class LicenseAssistantResolver {
  constructor(
    private readonly licenseAssistantService: LicenseAssistantService,
  ) {}

  @RequireAcceptedTerms()
  @Mutation(() => LicenseAssistantTurn, {
    description:
      'Send one message to the license assistant. Nothing is stored: send the conversation of the previous answer back with the next message.',
  })
  async draftLicense(
    @Args('input', { type: () => DraftLicenseInput })
    input: DraftLicenseInput,
    @CurrentUser() user: IAuthUser,
  ): Promise<LicenseAssistantTurn> {
    return this.licenseAssistantService.draft(user.sub, input);
  }

  @Query(() => [CanonicalLicenseSummary], {
    description: 'The canonical licenses the assistant offers',
  })
  async canonicalLicenses(): Promise<CanonicalLicenseSummary[]> {
    return this.licenseAssistantService.listCanonicalLicenses();
  }

  @Query(() => CanonicalLicense, {
    description: 'One canonical license with its full text',
  })
  async canonicalLicense(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<CanonicalLicense> {
    return this.licenseAssistantService.getCanonicalLicense(id);
  }
}

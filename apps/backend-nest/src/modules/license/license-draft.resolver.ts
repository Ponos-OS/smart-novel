import {
  Args,
  ID,
  Int,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { Role } from '@smart-novel/shared';

import { CurrentUser, type IAuthUser, RequireRole } from '../auth';
import { RequireAcceptedTerms } from '../platform-terms';
import {
  CreateLicenseDraftInput,
  LicenseDraftFiltersInput,
  SaveLicenseDraftInput,
} from './inputs';
import { LicenseDraftService } from './services';
import {
  License,
  LicenseDraft,
  LicenseDraftConnection,
} from './types';

@RequireRole(Role.writer)
@Resolver(() => LicenseDraft)
export class LicenseDraftResolver {
  constructor(
    private readonly licenseDraftService: LicenseDraftService,
  ) {}

  @Query(() => LicenseDraftConnection, {
    description:
      "Paginated license drafts, newest save first. A writer gets their own; an admin gets everybody's, or the writers named in `filters.ownerIds`.",
  })
  async licenseDraftsConnection(
    @CurrentUser() user: IAuthUser,
    @Args('first', { type: () => Int, nullable: true })
    first?: number,
    @Args('last', { type: () => Int, nullable: true }) last?: number,
    @Args('after', { type: () => String, nullable: true })
    after?: string,
    @Args('before', { type: () => String, nullable: true })
    before?: string,
    @Args('filters', {
      type: () => LicenseDraftFiltersInput,
      nullable: true,
    })
    filters?: LicenseDraftFiltersInput,
  ): Promise<LicenseDraftConnection> {
    return this.licenseDraftService.findConnection(
      this.toViewer(user),
      { first, last, after, before },
      filters,
    );
  }

  @Query(() => LicenseDraft, {
    description:
      "A license draft of the caller; an admin can read anybody's. Another writer's is not found.",
  })
  async licenseDraft(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: IAuthUser,
  ): Promise<LicenseDraft> {
    return this.licenseDraftService.findOne(this.toViewer(user), id);
  }

  @RequireAcceptedTerms()
  @Mutation(() => LicenseDraft, {
    description:
      'Start a license draft, from the text of a license, of a canonical license, or from nothing. Returns it with its id; save it by that id.',
  })
  async createLicenseDraft(
    @Args('input', { type: () => CreateLicenseDraftInput })
    input: CreateLicenseDraftInput,
    @CurrentUser() user: IAuthUser,
  ): Promise<LicenseDraft> {
    return this.licenseDraftService.create(user.sub, input);
  }

  @RequireAcceptedTerms()
  @Mutation(() => LicenseDraft, {
    description:
      'Save the whole draft. Saving what is already saved writes nothing. The last save wins.',
  })
  async saveLicenseDraft(
    @Args('input', { type: () => SaveLicenseDraftInput })
    input: SaveLicenseDraftInput,
    @CurrentUser() user: IAuthUser,
  ): Promise<LicenseDraft> {
    return this.licenseDraftService.save(user.sub, input);
  }

  @RequireAcceptedTerms()
  @Mutation(() => License, {
    description:
      "Say the draft is finished: it becomes a license, or is replaced by the stored license with the same text. Use the returned license, its id can differ from the draft's. The draft is gone afterwards.",
  })
  async finalizeLicenseDraft(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: IAuthUser,
  ): Promise<License> {
    return this.licenseDraftService.finalize(user.sub, id);
  }

  @RequireAcceptedTerms()
  @Mutation(() => Boolean, {
    description: 'Throw a draft away',
  })
  async discardLicenseDraft(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: IAuthUser,
  ): Promise<boolean> {
    await this.licenseDraftService.discard(user.sub, id);

    return true;
  }

  private toViewer(user: IAuthUser) {
    return { id: user.sub, isAdmin: user.roles.includes(Role.admin) };
  }
}

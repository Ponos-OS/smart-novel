import {
  Args,
  ID,
  Int,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { isAdmin, Role } from '@smart-novel/shared';

import { ParseUuidPipe } from '../../shared';
import {
  CurrentUser,
  CurrentUserOptional,
  type IAuthUser,
  Public,
  RequireRole,
} from '../auth';
import { RequireAcceptedTerms } from '../platform-terms';
import {
  CreateTagInput,
  RequestTagInput,
  TagFiltersInput,
  UpdateTagInput,
} from './inputs';
import { TagService } from './services';
import { DeleteTagResponse, Tag, TagConnection } from './types';

@Resolver()
export class TagResolver {
  constructor(private readonly tagService: TagService) {}

  @Public()
  @Query(() => TagConnection, {
    description:
      'Paginated tags ordered by name. Without `first` or `last` a page of 20 is returned, at most 100 are allowed. Callers who are not admins get only the approved ones.',
  })
  async tagsConnection(
    @CurrentUserOptional() user?: IAuthUser,
    @Args('first', { type: () => Int, nullable: true })
    first?: number,
    @Args('last', { type: () => Int, nullable: true }) last?: number,
    @Args('after', { type: () => String, nullable: true })
    after?: string,
    @Args('before', { type: () => String, nullable: true })
    before?: string,
    @Args('filters', {
      type: () => TagFiltersInput,
      nullable: true,
    })
    filters?: TagFiltersInput,
  ): Promise<TagConnection> {
    return this.tagService.findConnection(
      isAdmin(user?.roles ?? []),
      { first, last, after, before },
      filters,
    );
  }

  @RequireRole(Role.writer)
  @RequireAcceptedTerms()
  @Mutation(() => Tag, {
    description:
      'Ask for a tag that does not exist yet, with a required short description of what it is for. It is PENDING, and cannot be put on novels, until an admin approves it; the admin may change the name and the description first. A name that already exists, even in another case, is a 400 that names the existing tag.',
  })
  async requestTag(
    @Args('input', { type: () => RequestTagInput })
    input: RequestTagInput,
    @CurrentUser() user: IAuthUser,
  ): Promise<Tag> {
    return this.tagService.request(user.sub, input);
  }

  @RequireRole(Role.admin)
  @RequireAcceptedTerms()
  @Mutation(() => Tag, {
    description:
      'Admin only. Create a tag that is APPROVED right away, so writers can put it on novels. A name that already exists, even in another case, is a 400 that names the existing tag.',
  })
  async createTag(
    @Args('input', { type: () => CreateTagInput })
    input: CreateTagInput,
  ): Promise<Tag> {
    return this.tagService.create(input);
  }

  @RequireRole(Role.admin)
  @RequireAcceptedTerms()
  @Mutation(() => Tag, {
    description:
      'Admin only. Approve a pending tag; approving an approved one changes nothing.',
  })
  async approveTag(
    @Args(
      'id',
      { type: () => ID, description: 'The ID of the tag' },
      ParseUuidPipe,
    )
    id: string,
  ): Promise<Tag> {
    return this.tagService.approve(id);
  }

  @RequireRole(Role.admin)
  @RequireAcceptedTerms()
  @Mutation(() => Tag, {
    description: `Admin only. Change the name, the description or both of a tag of any status; the novels that have it follow a rename. At least one is required. A name that already exists is a 400.`,
  })
  async updateTag(
    @Args(
      'id',
      { type: () => ID, description: 'The ID of the tag' },
      ParseUuidPipe,
    )
    id: string,
    @Args('input', { type: () => UpdateTagInput })
    input: UpdateTagInput,
  ): Promise<Tag> {
    return this.tagService.update(id, input);
  }

  @RequireRole(Role.admin)
  @RequireAcceptedTerms()
  @Mutation(() => DeleteTagResponse, {
    description:
      'Admin only. Delete a tag of any status, which also rejects a pending request. It is removed from every novel that has it; the novels stay.',
  })
  async deleteTag(
    @Args(
      'id',
      { type: () => ID, description: 'The ID of the tag' },
      ParseUuidPipe,
    )
    id: string,
  ): Promise<DeleteTagResponse> {
    return this.tagService.delete(id);
  }
}

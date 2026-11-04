import {
  ID,
  Int,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { isAdmin } from '@smart-novel/shared';

import { CurrentUserOptional, type IAuthUser, Public } from '../auth';
import { TagNovelCountDataLoader } from './dataloaders';
import { Tag } from './types';

@Public()
@Resolver(() => Tag)
export class TagFieldResolver {
  constructor(
    private readonly tagNovelCountDataLoader: TagNovelCountDataLoader,
  ) {}

  @ResolveField(() => Int, {
    description:
      'An estimate of how many novels have this tag, taken from the database planner rather than counted. It can be off, most for small tags, and is never exact.',
  })
  async approximateNovelCount(@Parent() tag: Tag): Promise<number> {
    return this.tagNovelCountDataLoader.load(tag.id);
  }

  @ResolveField(() => ID, {
    nullable: true,
    description:
      'Admin only: the ID of the writer who requested the tag. Null for everybody else, and for tags nobody requested.',
  })
  requesterUserId(
    @Parent() tag: Tag,
    @CurrentUserOptional() user?: IAuthUser,
  ): string | null {
    if (!isAdmin(user?.roles ?? [])) {
      return null;
    }

    return tag.requesterUserId ?? null;
  }
}

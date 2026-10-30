import {
  ID,
  Int,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { isAdmin } from '@smart-novel/shared';

import { CurrentUserOptional, type IAuthUser, Public } from '../auth';
import { CategoryNovelCountDataLoader } from './dataloaders';
import { Category } from './types';

@Public()
@Resolver(() => Category)
export class CategoryFieldResolver {
  constructor(
    private readonly categoryNovelCountDataLoader: CategoryNovelCountDataLoader,
  ) {}

  @ResolveField(() => Int, {
    description:
      'An estimate of how many novels have this category, taken from the database planner rather than counted. It can be off, most for small categories, and is never exact.',
  })
  async approximateNovelCount(
    @Parent() category: Category,
  ): Promise<number> {
    return this.categoryNovelCountDataLoader.load(category.id);
  }

  @ResolveField(() => ID, {
    nullable: true,
    description:
      'Admin only: the ID of the writer who requested the category. Null for everybody else, and for categories nobody requested.',
  })
  requesterUserId(
    @Parent() category: Category,
    @CurrentUserOptional() user?: IAuthUser,
  ): string | null {
    if (!isAdmin(user?.roles ?? [])) {
      return null;
    }

    return category.requesterUserId ?? null;
  }
}

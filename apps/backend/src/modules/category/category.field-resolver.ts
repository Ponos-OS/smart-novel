import { Int, Parent, ResolveField, Resolver } from '@nestjs/graphql';

import { Public } from '../auth';
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
}

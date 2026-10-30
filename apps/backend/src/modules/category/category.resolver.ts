import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { isAdmin } from '@smart-novel/shared';

import { CurrentUserOptional, type IAuthUser, Public } from '../auth';
import { CategoryFiltersInput } from './inputs';
import { CategoryService } from './services';
import { CategoryConnection } from './types';

@Resolver()
export class CategoryResolver {
  constructor(private readonly categoryService: CategoryService) {}

  @Public()
  @Query(() => CategoryConnection, {
    description:
      'Paginated categories ordered by name. Without `first` or `last` a page of 20 is returned, at most 100 are allowed. Callers who are not admins get only the approved ones.',
  })
  async categoriesConnection(
    @CurrentUserOptional() user?: IAuthUser,
    @Args('first', { type: () => Int, nullable: true })
    first?: number,
    @Args('last', { type: () => Int, nullable: true }) last?: number,
    @Args('after', { type: () => String, nullable: true })
    after?: string,
    @Args('before', { type: () => String, nullable: true })
    before?: string,
    @Args('filters', {
      type: () => CategoryFiltersInput,
      nullable: true,
    })
    filters?: CategoryFiltersInput,
  ): Promise<CategoryConnection> {
    return this.categoryService.findConnection(
      isAdmin(user?.roles ?? []),
      { first, last, after, before },
      filters,
    );
  }
}

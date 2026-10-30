import {
  Args,
  ID,
  Int,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { isAdmin, Role } from '@smart-novel/shared';

import { ParseUuidPipe, RequiredStringPipe } from '../../shared';
import {
  CurrentUser,
  CurrentUserOptional,
  type IAuthUser,
  Public,
  RequireRole,
} from '../auth';
import { RequireAcceptedTerms } from '../platform-terms';
import { CategoryFiltersInput } from './inputs';
import { CategoryService } from './services';
import {
  Category,
  CategoryConnection,
  DeleteCategoryResponse,
} from './types';

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

  @RequireRole(Role.writer)
  @RequireAcceptedTerms()
  @Mutation(() => Category, {
    description:
      'Ask for a category that does not exist yet. It is PENDING, and cannot be put on novels, until an admin approves it. A name that already exists, even in another case, is a 400 that names the existing category.',
  })
  async requestCategory(
    @Args('name', { type: () => String }, RequiredStringPipe)
    name: string,
    @CurrentUser() user: IAuthUser,
  ): Promise<Category> {
    return this.categoryService.request(user.sub, name);
  }

  @RequireRole(Role.admin)
  @RequireAcceptedTerms()
  @Mutation(() => Category, {
    description:
      'Admin only. Approve a pending category; approving an approved one changes nothing.',
  })
  async approveCategory(
    @Args(
      'id',
      { type: () => ID, description: 'The ID of the category' },
      ParseUuidPipe,
    )
    id: string,
  ): Promise<Category> {
    return this.categoryService.approve(id);
  }

  @RequireRole(Role.admin)
  @RequireAcceptedTerms()
  @Mutation(() => Category, {
    description:
      'Admin only. Rename a category of any status; the novels that have it follow. A name that already exists is a 400.',
  })
  async updateCategory(
    @Args(
      'id',
      { type: () => ID, description: 'The ID of the category' },
      ParseUuidPipe,
    )
    id: string,
    @Args('name', { type: () => String }, RequiredStringPipe)
    name: string,
  ): Promise<Category> {
    return this.categoryService.rename(id, name);
  }

  @RequireRole(Role.admin)
  @RequireAcceptedTerms()
  @Mutation(() => DeleteCategoryResponse, {
    description:
      'Admin only. Delete a category of any status, which also rejects a pending request. It is removed from every novel that has it; the novels stay.',
  })
  async deleteCategory(
    @Args(
      'id',
      { type: () => ID, description: 'The ID of the category' },
      ParseUuidPipe,
    )
    id: string,
  ): Promise<DeleteCategoryResponse> {
    return this.categoryService.delete(id);
  }
}

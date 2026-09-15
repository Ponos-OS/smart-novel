import {
  Args,
  ID,
  Int,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { isNil } from 'nestjs-backend-common';

import { ParseUuidPipe } from '../../../shared';
import {
  CurrentUserOptional,
  type IAuthUser,
  Public,
  Role,
} from '../../auth';
import { NovelAction } from '../enums';
import {
  ChapterFiltersInput,
  ChapterOrderByInput,
  NovelFiltersInput,
} from '../inputs';
import { NovelService } from '../services';
import {
  Chapter,
  ChapterConnection,
  Novel,
  NovelConnection,
} from '../types';

@Resolver(() => Novel)
export class NovelResolver {
  constructor(private readonly novelService: NovelService) {}

  @Public()
  @Query(() => Novel, { description: 'Find a novel by its ID' })
  async novel(
    @Args(
      'id',
      {
        type: () => ID,
        description: 'The ID of the novel',
      },
      ParseUuidPipe,
    )
    id: string,
  ): Promise<Novel> {
    const novel = await this.novelService.findOne(id);

    return novel;
  }

  @Public()
  @Query(() => NovelConnection, {
    description: 'Paginated list of novels',
  })
  async novelsConnection(
    @Args('first', { type: () => Int, nullable: true })
    first?: number,
    @Args('last', { type: () => Int, nullable: true }) last?: number,
    @Args('after', { type: () => String, nullable: true })
    after?: string,
    @Args('before', { type: () => String, nullable: true })
    before?: string,
    @Args('filters', {
      type: () => NovelFiltersInput,
      nullable: true,
    })
    filters?: NovelFiltersInput,
  ): Promise<NovelConnection> {
    return this.novelService.findNovelsConnection(
      first,
      last,
      after,
      before,
      filters,
    );
  }

  @Public()
  @Query(() => [String], {
    description: 'Get all available novel categories',
  })
  async categories(): Promise<string[]> {
    return this.novelService.getCategories();
  }

  @ResolveField(() => [NovelAction], {
    description:
      'Actions the current user is allowed to perform on this novel',
  })
  allowedActions(
    @Parent() novel: Novel,
    @CurrentUserOptional() user?: IAuthUser,
  ): NovelAction[] {
    if (isNil(user)) {
      return [];
    }

    const isOwner = novel.ownerId === user.sub;
    const isAdmin = user.roles.includes(Role.admin);

    if (isOwner || isAdmin) {
      return [NovelAction.MANAGE_TTS, NovelAction.EDIT_CONTENT];
    }

    return [];
  }

  @ResolveField(() => ChapterConnection, {
    description: 'Paginated list of chapters for this novel',
  })
  async chaptersConnection(
    @Parent() novel: Novel,
    @Args('first', { type: () => Int, nullable: true })
    first?: number,
    @Args('last', { type: () => Int, nullable: true })
    last?: number,
    @Args('after', { type: () => String, nullable: true })
    after?: string,
    @Args('before', { type: () => String, nullable: true })
    before?: string,
    @Args('orderBy', {
      type: () => ChapterOrderByInput,
      nullable: true,
    })
    orderBy?: ChapterOrderByInput,
    @Args('filters', {
      type: () => ChapterFiltersInput,
      nullable: true,
    })
    filters?: ChapterFiltersInput,
  ): Promise<ChapterConnection> {
    return this.novelService.getChaptersConnection(
      novel.id,
      first,
      last,
      after,
      before,
      orderBy,
      filters,
    );
  }

  @ResolveField(() => Chapter, {
    nullable: true,
    description: 'Chapter of the novel',
  })
  async chapter(
    @Parent() novel: Novel,
    @Args(
      'id',
      {
        type: () => ID,
        description: 'The ID of the chapter',
      },
      ParseUuidPipe,
    )
    id: string,
  ): Promise<Chapter | null> {
    return this.novelService.getChapter(novel.id, id);
  }

  @ResolveField(() => String, {
    nullable: true,
    description:
      'ISO date string of when the last chapter was published',
  })
  async lastChapterPublishedAt(
    @Parent() novel: Novel,
  ): Promise<string | null> {
    const lastChapter = await this.novelService.getLastChapter(
      novel.id,
    );

    return lastChapter ? lastChapter.updatedAt : null;
  }

  @ResolveField(() => Chapter, {
    nullable: true,
    description: 'The most recently published chapter',
  })
  async lastPublishedChapter(
    @Parent() novel: Novel,
  ): Promise<Chapter | null> {
    return this.novelService.getLastChapter(novel.id);
  }

  @ResolveField(() => Chapter, {
    nullable: true,
    description: 'The first chapter of the novel',
  })
  async firstChapter(
    @Parent() novel: Novel,
  ): Promise<Chapter | null> {
    return this.novelService.getFirstChapter(novel.id);
  }
}

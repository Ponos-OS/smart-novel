import { Inject } from '@nestjs/common';
import { Int, Parent, ResolveField, Resolver } from '@nestjs/graphql';

import { Public } from '../../auth';
import {
  CHAPTER_REPOSITORY,
  type IChapterRepository,
} from '../interfaces';
import { ChapterConnection } from '../types';

@Public()
@Resolver(() => ChapterConnection)
export class ChapterConnectionFieldResolver {
  constructor(
    @Inject(CHAPTER_REPOSITORY)
    private readonly chapterRepository: IChapterRepository,
  ) {}

  @ResolveField(() => Int, {
    description: 'Total number of chapters matching the filters',
  })
  async totalCount(
    @Parent() connection: ChapterConnection,
  ): Promise<number> {
    const context = connection._filterContext;

    if (!context) {
      return 0;
    }

    return this.chapterRepository.countChapters(
      context.novelId,
      context.filters,
    );
  }
}

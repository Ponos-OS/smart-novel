import { BadRequestException } from '@nestjs/common';
import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { isNil } from 'nestjs-backend-common';

import type { IAuthUser } from '../../auth/interfaces';

import { CurrentUserOptional, Public } from '../../auth';
import {
  ChapterContentDataLoader,
  ChapterNavigationDataLoader,
  ChapterViewerStateDataLoader,
} from '../dataloaders';
import { Chapter, ChapterViewerState } from '../types';

@Public()
@Resolver(() => Chapter)
export class ChapterFieldResolver {
  constructor(
    private readonly chapterContentDataLoader: ChapterContentDataLoader,
    private readonly chapterNavigationDataLoader: ChapterNavigationDataLoader,
    private readonly chapterViewerStateDataLoader: ChapterViewerStateDataLoader,
  ) {}

  @ResolveField(() => String, {
    description: 'The content of the chapter in markdown format',
  })
  async content(@Parent() chapter: Chapter): Promise<string> {
    const chapterContent = await this.chapterContentDataLoader.load(
      chapter.contentId,
    );

    if (!chapterContent) {
      throw new BadRequestException('Chapter content not found');
    }

    return chapterContent.content;
  }

  @ResolveField(() => String, {
    description:
      'ISO 8601 timestamp of when the chapter content was last updated. Pass this back as expectedContentUpdatedAt on updateContent to detect concurrent edits.',
  })
  async contentUpdatedAt(
    @Parent() chapter: Chapter,
  ): Promise<string> {
    const chapterContent = await this.chapterContentDataLoader.load(
      chapter.contentId,
    );

    if (!chapterContent) {
      throw new BadRequestException('Chapter content not found');
    }

    return chapterContent.updatedAt;
  }

  @ResolveField(() => Chapter, {
    nullable: true,
    description: 'The next chapter',
  })
  async next(@Parent() chapter: Chapter): Promise<Chapter | null> {
    return this.chapterNavigationDataLoader.load({
      novelId: chapter.novelId,
      chapterNumber: chapter.chapterNumber,
      adjacency: 'next',
    });
  }

  @ResolveField(() => Chapter, {
    nullable: true,
    description: 'The previous chapter',
  })
  async previous(
    @Parent() chapter: Chapter,
  ): Promise<Chapter | null> {
    return this.chapterNavigationDataLoader.load({
      novelId: chapter.novelId,
      chapterNumber: chapter.chapterNumber,
      adjacency: 'previous',
    });
  }

  @ResolveField(() => ChapterViewerState, {
    description: 'Viewer-specific state for this chapter',
  })
  async viewerState(
    @Parent() chapter: Chapter,
    @CurrentUserOptional() user?: IAuthUser,
  ): Promise<ChapterViewerState> {
    if (isNil(user?.sub)) {
      return {
        isRead: false,
        readAt: undefined,
      };
    }

    this.chapterViewerStateDataLoader.setUserId(user.sub);

    return this.chapterViewerStateDataLoader.load(chapter.id);
  }
}

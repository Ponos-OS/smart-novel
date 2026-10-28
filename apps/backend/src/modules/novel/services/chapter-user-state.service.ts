import {
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { MARK_CHAPTERS_READ_MAX_BATCH_SIZE } from '@smart-novel/shared';
import { arrayMaxSize } from 'class-validator';

import {
  CHAPTER_REPOSITORY,
  CHAPTER_USER_STATE_REPOSITORY,
  type IChapterRepository,
  type IChapterUserStateRepository,
} from '../interfaces';

@Injectable()
export class ChapterUserStateService {
  constructor(
    @Inject(CHAPTER_USER_STATE_REPOSITORY)
    private readonly chapterUserStateRepository: IChapterUserStateRepository,
    @Inject(CHAPTER_REPOSITORY)
    private readonly chapterRepository: IChapterRepository,
  ) {}

  async markChaptersRead(
    userId: string,
    chapterIds: string[],
  ): Promise<number> {
    if (chapterIds.length === 0) {
      return 0;
    }

    if (
      !arrayMaxSize(chapterIds, MARK_CHAPTERS_READ_MAX_BATCH_SIZE)
    ) {
      throw new BadRequestException(
        `Maximum ${MARK_CHAPTERS_READ_MAX_BATCH_SIZE} chapters can be marked as read per request`,
      );
    }

    const chapters =
      await this.chapterRepository.findManyBy(chapterIds);

    if (chapters.length === 0) {
      return 0;
    }

    const chapterData = chapters.map((ch) => ({
      chapterId: ch.id,
      novelId: ch.novelId,
    }));

    return this.chapterUserStateRepository.markChaptersRead(
      userId,
      chapterData,
    );
  }

  deleteReadHistory(userId: string): Promise<number> {
    return this.chapterUserStateRepository.deleteAllForUser(userId);
  }
}

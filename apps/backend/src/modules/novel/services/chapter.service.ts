import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { UpdateChapterInput } from '../inputs';
import {
  CHAPTER_CONTENT_REPOSITORY,
  CHAPTER_REPOSITORY,
  IChapter,
  type IChapterContentRepository,
  type IChapterRepository,
} from '../interfaces';

@Injectable()
export class ChapterService {
  constructor(
    @Inject(CHAPTER_REPOSITORY)
    private readonly chapterRepository: IChapterRepository,
    @Inject(CHAPTER_CONTENT_REPOSITORY)
    private readonly chapterContentRepository: IChapterContentRepository,
  ) {}

  async updateChapter(
    chapterId: string,
    input: UpdateChapterInput,
    expectedUpdatedAt: string,
  ): Promise<IChapter> {
    const chapter = await this.chapterRepository.findById(chapterId);

    if (!chapter) {
      throw new NotFoundException(
        `Chapter with id ${chapterId} not found`,
      );
    }

    if (
      new Date(chapter.updatedAt).getTime() !==
      new Date(expectedUpdatedAt).getTime()
    ) {
      throw new ConflictException(
        'This chapter was updated by someone else. Reload to get the latest version before saving.',
      );
    }

    return this.chapterRepository.updateChapterMetadata(
      chapterId,
      input,
    );
  }

  async updateContent(
    chapterId: string,
    content: string,
    expectedContentUpdatedAt: string,
  ): Promise<IChapter> {
    const chapter = await this.chapterRepository.findById(chapterId);

    if (!chapter) {
      throw new NotFoundException(
        `Chapter with id ${chapterId} not found`,
      );
    }

    const currentContent =
      await this.chapterContentRepository.findByChapterId(chapterId);

    if (
      new Date(currentContent.updatedAt).getTime() !==
      new Date(expectedContentUpdatedAt).getTime()
    ) {
      throw new ConflictException(
        'This chapter was updated by someone else. Reload to get the latest version before saving.',
      );
    }

    await this.chapterContentRepository.upsertByChapterId(
      chapterId,
      content,
    );

    return chapter;
  }
}

import {
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
  ): Promise<IChapter> {
    const chapter = await this.chapterRepository.findById(chapterId);

    if (!chapter) {
      throw new NotFoundException(
        `Chapter with id ${chapterId} not found`,
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
  ): Promise<IChapter> {
    const chapter = await this.chapterRepository.findById(chapterId);

    if (!chapter) {
      throw new NotFoundException(
        `Chapter with id ${chapterId} not found`,
      );
    }

    await this.chapterContentRepository.upsertByChapterId(
      chapterId,
      content,
    );

    return chapter;
  }
}

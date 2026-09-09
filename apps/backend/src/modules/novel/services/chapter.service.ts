import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

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

  // TODO:
  // createChapter(novelId: string, input: CreateChapterInput, makeNecessaryAdjustments: boolean) {
  //   // 1. Check if we have a chapter with that novel:
  //   //    1.1. If it does exists throw an error.
  //   //         - Backend should ignore this if they provide a makeNecessaryAdjustments
  //   //    1.2. If it does not exists check if is the next free number for the novel!
  //   // 2. If makeNecessaryAdjustments is present then make sure the novel's chapter number make sense even after chapter creation.
  // }

  // TODO:
  // updateChapter(chapterId: string, input: UpdateChapterInput, makeNecessaryAdjustments: boolean) {
  //   // 1. Check if we have a chapter with that novel:
  //   //    1.1. If it does exists throw an error.
  //   //         - Backend should ignore this if they provide a makeNecessaryAdjustments
  //   //    1.2. If it does not exists check if is the next free number for the novel!
  //   // 2. If makeNecessaryAdjustments is present then make sure the novel's chapter number make sense even after chapter creation.
  // }

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

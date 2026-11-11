import { Inject, Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';

import {
  CHAPTER_CONTENT_REPOSITORY,
  type IChapterContent,
  type IChapterContentRepository,
} from '../interfaces';

@Injectable({ scope: Scope.REQUEST })
export class ChapterContentDataLoader {
  private readonly loader: DataLoader<string, IChapterContent | null>;

  constructor(
    @Inject(CHAPTER_CONTENT_REPOSITORY)
    private readonly chapterContentRepository: IChapterContentRepository,
  ) {
    this.loader = new DataLoader<string, IChapterContent | null>(
      async (contentIds) => {
        const map = await this.chapterContentRepository.findByIds([
          ...contentIds,
        ]);

        return contentIds.map((id) => map.get(id) ?? null);
      },
    );
  }

  async load(contentId: string): Promise<IChapterContent | null> {
    return this.loader.load(contentId);
  }
}

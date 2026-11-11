import { Inject, Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';

import {
  CHAPTER_REPOSITORY,
  type IChapter,
  type IChapterRepository,
} from '../interfaces';

/**
 * @description Composite key used to batch-load adjacent chapters via {@link ChapterNavigationDataLoader}.
 */
export interface ChapterNavigationKey {
  /** @description ID of the novel the chapter belongs to. */
  novelId: string;

  /** @description The `chapterNumber` of the current chapter. */
  chapterNumber: number;

  /** @description Whether to resolve the chapter that comes after (`next`) or before (`previous`) the current one. */
  adjacency: 'next' | 'previous';
}

/**
 * @summary DataLoader for batching chapter navigation (next/previous) lookups.
 *
 * @description
 * Collects all navigation requests within a single tick, computes the target `chapterNumber` for each (current ± 1), then fetches all needed chapters in **one** `findManyByNovelAndChapterNumbers` query instead of issuing a query per chapter.
 *
 * All `.load()` calls that happen synchronously before the JavaScript engine yields back to the event loop are collected together and fulfilled by a single batch function call.
 */
@Injectable({ scope: Scope.REQUEST })
export class ChapterNavigationDataLoader {
  private readonly loader: DataLoader<
    ChapterNavigationKey,
    IChapter | null
  >;

  constructor(
    @Inject(CHAPTER_REPOSITORY)
    private readonly chapterRepository: IChapterRepository,
  ) {
    this.loader = new DataLoader<
      ChapterNavigationKey,
      IChapter | null,
      string
    >((keys) => this.batchLoad([...keys]), {
      cacheKeyFn: (key) =>
        `${key.novelId}:${key.chapterNumber}:${key.adjacency}`,
    });
  }

  async load(key: ChapterNavigationKey): Promise<IChapter | null> {
    return this.loader.load(key);
  }

  private async batchLoad(
    keys: ChapterNavigationKey[],
  ): Promise<(IChapter | null)[]> {
    const lookups: Array<{
      novelId: string;
      chapterNumber: number;
    }> = [];

    for (const key of keys) {
      const targetNumber =
        key.adjacency === 'next'
          ? key.chapterNumber + 1
          : key.chapterNumber - 1;

      if (targetNumber >= 1) {
        lookups.push({
          novelId: key.novelId,
          chapterNumber: targetNumber,
        });
      }
    }

    const chapters =
      lookups.length > 0
        ? await this.chapterRepository.findManyByNovelAndChapterNumbers(
            lookups,
          )
        : [];
    const chapterMap = new Map<string, IChapter>();

    for (const chapter of chapters) {
      chapterMap.set(
        `${chapter.novelId}:${chapter.chapterNumber}`,
        chapter,
      );
    }

    return keys.map((key) => {
      const targetNumber =
        key.adjacency === 'next'
          ? key.chapterNumber + 1
          : key.chapterNumber - 1;

      if (targetNumber < 1) {
        return null;
      }

      return chapterMap.get(`${key.novelId}:${targetNumber}`) ?? null;
    });
  }
}

import { NarrationStatus } from '@prisma/client';

import { CursorPaginationParams } from '../../../shared';
import { IChapter } from './chapter.interface';

export interface ChapterCountContext {
  novelId: string;
  filters?: ChapterConnectionFilters;
}

export interface ChapterConnectionFilters {
  narrationStatus?: NarrationStatus;
}

export interface FindChaptersPageArgs {
  novelId: string;
  page: CursorPaginationParams;
  orderByField?: string;
  orderByDirection?: string;
  filters?: ChapterConnectionFilters;
}

export interface ChapterNovelKey {
  novelId: string;
  chapterNumber: number;
}

export interface CreateChapterData {
  novelId: string;
  title: string;
  content: string;
}

export type DeletedChapter = Pick<
  IChapter,
  'id' | 'novelId' | 'narrationUrl'
>;

export interface IChapterRepository {
  createChapter(data: CreateChapterData): Promise<IChapter>;
  getChapter(
    novelId: string,
    chapterId: string,
  ): Promise<IChapter | null>;
  findById(id: string): Promise<IChapter | null>;
  findManyBy(ids: string[]): Promise<IChapter[]>;
  findManyByNovelAndChapterNumbers(
    keys: ChapterNovelKey[],
  ): Promise<IChapter[]>;
  updateChapterMetadata(
    id: string,
    data: { title?: string },
  ): Promise<IChapter>;
  updateChapterNarrationUrl(id: string, url: string): Promise<void>;
  updateNarrationStatus(
    id: string,
    status: NarrationStatus,
  ): Promise<void>;
  updateChapterNarrationComplete(
    id: string,
    url: string,
  ): Promise<number>;
  findChaptersPage(args: FindChaptersPageArgs): Promise<IChapter[]>;
  countChapters(
    novelId: string,
    filters?: ChapterConnectionFilters,
  ): Promise<number>;
  getFirstChapter(novelId: string): Promise<IChapter | null>;
  getLastChapter(novelId: string): Promise<IChapter | null>;
  deleteChapter(id: string): Promise<DeletedChapter | null>;
}

export const CHAPTER_REPOSITORY = Symbol('CHAPTER_REPOSITORY');

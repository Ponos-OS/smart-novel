import { NarrationStatus } from '@prisma/client';

import { PaginationArgs, TrimmedResult } from '../../../shared';
import { IChapter } from './chapter.interface';

export interface ChapterCountContext {
  novelId: string;
  filters?: ChapterConnectionFilters;
}

export interface ChapterConnectionFilters {
  narrationStatus?: NarrationStatus;
}

export interface FindChaptersConnectionArgs {
  novelId: string;
  pagination?: PaginationArgs;
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
  findChaptersConnection(
    args: FindChaptersConnectionArgs,
  ): Promise<TrimmedResult<IChapter>>;
  countChapters(
    novelId: string,
    filters?: ChapterConnectionFilters,
  ): Promise<number>;
  getFirstChapter(novelId: string): Promise<IChapter | null>;
  getLastChapter(novelId: string): Promise<IChapter | null>;
}

export const CHAPTER_REPOSITORY = Symbol('CHAPTER_REPOSITORY');

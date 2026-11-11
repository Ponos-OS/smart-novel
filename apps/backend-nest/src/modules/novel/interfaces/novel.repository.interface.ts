import { NovelState } from '@prisma/client';

import {
  CursorPaginationParams,
  OrderDirection,
} from '../../../shared';
import { NovelOrderField } from '../enums';
import { INovel } from './novel-details.interface';

export interface NovelConnectionFilters {
  tagIn?: string[];
  tagNin?: string[];
  chapterCountMin?: number;
  chapterCountMax?: number;
  firstChapterCreatedFrom?: Date;
  firstChapterCreatedTo?: Date;
  state?: NovelState;
  /** @description `Writer.userId` values, at least one when present. */
  ownerIds?: string[];
}

export interface NovelPageOrder {
  field: NovelOrderField;
  direction: OrderDirection;
}

export interface FindNovelsPageArgs {
  page: CursorPaginationParams;
  filters?: NovelConnectionFilters;
  order: NovelPageOrder;
}

export interface CreateNovelData {
  /** @description The user ID of the writer; the writer's row must exist. */
  ownerId: string;
  licenseId: string;
  name: string;
  description: string;
  state?: NovelState;
  tags?: string[];
}

export type UpdateNovelData = Partial<
  Omit<CreateNovelData, 'ownerId'>
>;

export interface DeletedNovel {
  id: string;
  coverUrl?: string;
  narrationUrls: string[];
}

export interface NovelWithPreviousCover {
  novel: INovel;
  previousCoverUrl?: string;
}

export interface INovelRepository {
  findNovelsPage(args: FindNovelsPageArgs): Promise<INovel[]>;
  estimateChapterCounts(
    novelIds: string[],
  ): Promise<Map<string, number>>;
  findById(id: string): Promise<INovel | null>;
  createNovel(data: CreateNovelData): Promise<INovel>;
  updateNovel(id: string, data: UpdateNovelData): Promise<INovel>;
  deleteNovel(id: string): Promise<DeletedNovel | null>;
  setCoverUrl(
    id: string,
    coverUrl: string,
  ): Promise<NovelWithPreviousCover>;
}

export const NOVEL_REPOSITORY = Symbol('NOVEL_REPOSITORY');

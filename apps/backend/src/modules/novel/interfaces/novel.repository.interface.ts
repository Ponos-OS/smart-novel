import { NovelState } from '@prisma/client';

import { CursorPaginationParams } from '../../../shared';
import { INovel } from './novel-details.interface';

export interface NovelConnectionFilters {
  categoryIn?: string[];
  categoryNin?: string[];
}

export interface FindNovelsPageArgs {
  page: CursorPaginationParams;
  filters?: NovelConnectionFilters;
}

export interface CreateNovelData {
  ownerId: string;
  licenseId: string;
  name: string;
  author: string;
  description: string;
  state?: NovelState;
  categories?: string[];
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
  countNovels(filters?: NovelConnectionFilters): Promise<number>;
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

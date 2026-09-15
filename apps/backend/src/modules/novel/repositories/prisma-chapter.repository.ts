import { Injectable } from '@nestjs/common';
import {
  NarrationStatus,
  Prisma,
  Chapter as PrismaChapter,
} from '@prisma/client';

import {
  buildCursorPaginationParams,
  OrderDirection,
  trimCursorPaginationResults,
  TrimmedResult,
} from '../../../shared';
import { PrismaService } from '../../prisma';
import { ChapterOrderField } from '../enums';
import {
  type ChapterConnectionFilters,
  type ChapterNovelKey,
  type FindChaptersConnectionArgs,
  type IChapter,
  type IChapterRepository,
} from '../interfaces';
import { Chapter } from '../types';

const ORDER_FIELD_MAP: Record<string, string> = {
  [ChapterOrderField.CHAPTER_NUMBER]: 'chapterNumber',
  [ChapterOrderField.CREATED_AT]: 'createdAt',
  [ChapterOrderField.UPDATED_AT]: 'updatedAt',
};

@Injectable()
export class PrismaChapterRepository implements IChapterRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findChaptersConnection(
    args: FindChaptersConnectionArgs,
  ): Promise<TrimmedResult<IChapter>> {
    const {
      novelId,
      pagination,
      orderByField = ChapterOrderField.CHAPTER_NUMBER,
      orderByDirection = OrderDirection.ASC,
      filters,
    } = args;
    const prismaField =
      ORDER_FIELD_MAP[orderByField] ?? 'chapterNumber';
    const baseDirection =
      orderByDirection === OrderDirection.DESC ? 'desc' : 'asc';
    const where = this.buildChapterWhereClause(novelId, filters);
    const { cursor, skip, take, shouldReverse } =
      buildCursorPaginationParams(pagination);
    const findArgs: Prisma.ChapterFindManyArgs = {
      where,
      orderBy: {
        [prismaField]: shouldReverse
          ? baseDirection === 'asc'
            ? 'desc'
            : 'asc'
          : baseDirection,
      },
      select: {
        id: true,
        novelId: true,
        contentId: true,
        title: true,
        chapterNumber: true,
        narrationStatus: true,
        narrationUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    };

    if (cursor) {
      findArgs.cursor = cursor;
    }
    if (skip) {
      findArgs.skip = skip;
    }
    if (take) {
      findArgs.take = take;
    }

    const chapters = await this.prisma.chapter.findMany(findArgs);
    const { items, hasMore } = trimCursorPaginationResults(
      chapters,
      pagination,
      shouldReverse,
    );
    const mapped: IChapter[] = items.map((ch) => this.toChapter(ch));

    return { items: mapped, hasMore };
  }

  async countChapters(
    novelId: string,
    filters?: ChapterConnectionFilters,
  ): Promise<number> {
    const where = this.buildChapterWhereClause(novelId, filters);

    return this.prisma.chapter.count({ where });
  }

  async getFirstChapter(novelId: string): Promise<IChapter | null> {
    const chapter = await this.prisma.chapter.findFirst({
      where: { novelId },
      orderBy: { chapterNumber: 'asc' },
    });

    if (!chapter) {
      return null;
    }

    return this.toChapter(chapter);
  }

  async getLastChapter(novelId: string): Promise<IChapter | null> {
    const chapter = await this.prisma.chapter.findFirst({
      where: { novelId },
      orderBy: { chapterNumber: 'desc' },
    });

    if (!chapter) {
      return null;
    }

    return this.toChapter(chapter);
  }

  async getChapter(
    novelId: string,
    chapterId: string,
  ): Promise<Chapter | null> {
    const chapter = await this.prisma.chapter.findFirst({
      where: {
        id: chapterId,
        novelId: novelId,
      },
    });

    if (!chapter) {
      return null;
    }

    return this.toChapter(chapter);
  }

  async findById(id: string): Promise<Chapter | null> {
    const chapter = await this.prisma.chapter.findFirst({
      where: { id },
    });

    if (!chapter) {
      return null;
    }

    return this.toChapter(chapter);
  }

  async findManyBy(ids: string[]): Promise<IChapter[]> {
    const chapters = await this.prisma.chapter.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        novelId: true,
        contentId: true,
        title: true,
        chapterNumber: true,
        narrationStatus: true,
        narrationUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return chapters.map((ch) => this.toChapter(ch));
  }

  async findManyByNovelAndChapterNumbers(
    keys: ChapterNovelKey[],
  ): Promise<IChapter[]> {
    if (keys.length === 0) {
      return [];
    }

    const byNovel = new Map<string, number[]>();

    for (const { novelId, chapterNumber } of keys) {
      const numbers = byNovel.get(novelId) ?? [];
      numbers.push(chapterNumber);
      byNovel.set(novelId, numbers);
    }

    const where: Prisma.ChapterWhereInput = {
      OR: [...byNovel.entries()].map(([novelId, numbers]) => ({
        novelId,
        chapterNumber: { in: numbers },
      })),
    };
    const chapters = await this.prisma.chapter.findMany({
      where,
    });

    return chapters.map((ch) => this.toChapter(ch));
  }

  async updateChapterMetadata(
    id: string,
    data: { title?: string },
  ): Promise<IChapter> {
    const chapter = await this.prisma.chapter.update({
      where: { id },
      data,
    });

    return this.toChapter(chapter);
  }

  async updateChapterNarrationUrl(
    id: string,
    url: string,
  ): Promise<void> {
    await this.prisma.chapter.update({
      where: { id },
      data: { narrationUrl: url },
    });
  }

  async updateNarrationStatus(
    id: string,
    status: NarrationStatus,
  ): Promise<void> {
    await this.prisma.chapter.update({
      where: { id },
      data: { narrationStatus: status },
    });
  }

  async updateChapterNarrationComplete(
    id: string,
    url: string,
  ): Promise<number> {
    const result = await this.prisma.chapter.updateMany({
      where: {
        id,
        narrationStatus: NarrationStatus.PROCESSING,
      },
      data: {
        narrationUrl: url,
        narrationStatus: NarrationStatus.READY,
      },
    });
    return result.count;
  }

  private buildChapterWhereClause(
    novelId: string,
    filters?: ChapterConnectionFilters,
  ): Prisma.ChapterWhereInput {
    const where: Prisma.ChapterWhereInput = { novelId };

    if (filters?.narrationStatus) {
      where.narrationStatus = filters.narrationStatus;
    }

    return where;
  }

  private toChapter(chapter: PrismaChapter): Chapter {
    return {
      id: chapter.id,
      novelId: chapter.novelId,
      contentId: chapter.contentId ?? undefined,
      title: chapter.title,
      chapterNumber: chapter.chapterNumber,
      createdAt: chapter.createdAt.toISOString(),
      updatedAt: chapter.updatedAt.toISOString(),
      narrationStatus: chapter.narrationStatus as
        | NarrationStatus
        | undefined,
      narrationUrl: chapter.narrationUrl ?? undefined,
    };
  }
}

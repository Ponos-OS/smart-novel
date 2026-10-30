import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CategoryStatus,
  Prisma,
  Novel as PrismaNovel,
} from '@prisma/client';

import {
  buildCursorPaginationParams,
  trimCursorPaginationResults,
  TrimmedResult,
} from '../../../shared';
import { PrismaService } from '../../prisma';
import {
  type CreateNovelData,
  type DeletedNovel,
  type FindNovelsConnectionArgs,
  type INovelRepository,
  type NovelConnectionFilters,
  type NovelWithPreviousCover,
  type UpdateNovelData,
} from '../interfaces';
import { Novel } from '../types';

const NOVEL_INCLUDE = {
  categories: { select: { category: { select: { name: true } } } },
} satisfies Prisma.NovelInclude;

@Injectable()
export class PrismaNovelRepository implements INovelRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findNovelsConnection({
    pagination,
    filters,
  }: FindNovelsConnectionArgs): Promise<TrimmedResult<Novel>> {
    const where = this.buildNovelWhereClause(filters);
    const { cursor, skip, take, shouldReverse } =
      buildCursorPaginationParams(pagination);

    const findArgs: Prisma.NovelFindManyArgs = {
      where,
      orderBy: { name: shouldReverse ? 'desc' : 'asc' },
      include: {
        categories: {
          select: {
            category: {
              select: {
                name: true,
              },
            },
          },
        },
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

    const novels = await this.prisma.novel.findMany(findArgs);
    const { items, hasMore } = trimCursorPaginationResults(
      novels,
      pagination,
      shouldReverse,
    );
    const mapped: Novel[] = items.map((novel) =>
      this.toNovel(
        novel as PrismaNovel & {
          categories: { category: { name: string } }[];
        },
      ),
    );

    return { items: mapped, hasMore };
  }

  async countNovels(
    filters?: NovelConnectionFilters,
  ): Promise<number> {
    const where = this.buildNovelWhereClause(filters);

    return this.prisma.novel.count({ where });
  }

  async findById(id: string): Promise<Novel | null> {
    const novel = await this.prisma.novel.findUnique({
      where: { id },
      include: {
        categories: {
          select: {
            category: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!novel) {
      return null;
    }

    return this.toNovel(novel);
  }

  async createNovel(data: CreateNovelData): Promise<Novel> {
    const { categories, ...fields } = data;

    return this.prisma.$transaction(async (tx) => {
      const categoryIds = await this.resolveCategoryIds(
        tx,
        categories ?? [],
      );
      const novel = await tx.novel.create({
        data: {
          ...fields,
          categories: {
            create: categoryIds.map((categoryId) => ({ categoryId })),
          },
        },
        include: NOVEL_INCLUDE,
      });

      return this.toNovel(novel);
    });
  }

  async updateNovel(
    id: string,
    data: UpdateNovelData,
  ): Promise<Novel> {
    const {
      name,
      author,
      description,
      state,
      categories,
      licenseId,
    } = data;

    return this.prisma.$transaction(async (tx) => {
      const categoryIds = categories
        ? await this.resolveCategoryIds(tx, categories)
        : undefined;
      const novel = await tx.novel.update({
        where: { id },
        data: {
          name: name ?? undefined,
          author: author ?? undefined,
          description: description ?? undefined,
          state: state ?? undefined,
          licenseId: licenseId ?? undefined,
          categories: categoryIds && {
            deleteMany: {},
            create: categoryIds.map((categoryId) => ({ categoryId })),
          },
        },
        include: NOVEL_INCLUDE,
      });

      return this.toNovel(novel);
    });
  }

  async setCoverUrl(
    id: string,
    coverUrl: string,
  ): Promise<NovelWithPreviousCover> {
    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.novel.findUniqueOrThrow({
        where: { id },
        select: { coverUrl: true },
      });
      const novel = await tx.novel.update({
        where: { id },
        data: { coverUrl },
        include: NOVEL_INCLUDE,
      });

      return {
        novel: this.toNovel(novel),
        previousCoverUrl: previous.coverUrl ?? undefined,
      };
    });
  }

  async deleteNovel(id: string): Promise<DeletedNovel | null> {
    return this.prisma.$transaction(async (tx) => {
      // Same lock `createChapter` takes, so a chapter being added cannot slip in mid-delete.
      await tx.$queryRaw`SELECT id FROM novels WHERE id = ${id}::uuid FOR UPDATE`;

      const novel = await tx.novel.findUnique({
        where: { id },
        select: {
          coverUrl: true,
          chapters: {
            select: { contentId: true, narrationUrl: true },
          },
        },
      });

      if (!novel) {
        return null;
      }

      // The novel delete cascades to chapters, read history and category links, but the relation between a chapter and its content cascades the other way, so the content rows are removed explicitly.
      await tx.novel.delete({ where: { id } });
      await tx.chapterContent.deleteMany({
        where: {
          id: {
            in: novel.chapters.map((chapter) => chapter.contentId),
          },
        },
      });

      return {
        id,
        coverUrl: novel.coverUrl ?? undefined,
        narrationUrls: novel.chapters.flatMap((chapter) =>
          chapter.narrationUrl ? [chapter.narrationUrl] : [],
        ),
      };
    });
  }

  /**
   * @description Existing categories are matched case-insensitively (seed data has mixed casing); only the missing ones are created.
   */
  private async resolveCategoryIds(
    tx: Prisma.TransactionClient,
    names: string[],
  ): Promise<string[]> {
    if (names.length === 0) {
      return [];
    }

    const approved = await tx.category.findMany({
      where: {
        name: { in: names, mode: 'insensitive' },
        status: CategoryStatus.APPROVED,
      },
      select: { id: true, name: true },
    });
    const approvedNames = new Set(
      approved.map((category) => category.name.toLowerCase()),
    );
    const unavailable = names.filter(
      (name) => !approvedNames.has(name),
    );

    if (unavailable.length > 0) {
      throw new BadRequestException(
        `These categories are not available: ${unavailable.join(', ')}. Request a new category and add it once an admin approved it.`,
      );
    }

    return approved.map((category) => category.id);
  }

  private buildNovelWhereClause(
    filters?: NovelConnectionFilters,
  ): Prisma.NovelWhereInput {
    const where: Prisma.NovelWhereInput = {};

    if (filters?.categoryIn && filters.categoryIn.length > 0) {
      where.categories = {
        some: {
          category: {
            name: { in: filters.categoryIn, mode: 'insensitive' },
          },
        },
      };
    }

    if (filters?.categoryNin && filters.categoryNin.length > 0) {
      where.NOT = {
        categories: {
          some: {
            category: {
              name: { in: filters.categoryNin, mode: 'insensitive' },
            },
          },
        },
      };
    }

    return where;
  }

  private toNovel(
    record: PrismaNovel & {
      categories: { category: { name: string } }[];
    },
  ): Novel {
    return {
      id: record.id,
      name: record.name,
      author: record.author,
      description: record.description,
      state: record.state,
      ownerId: record.ownerId,
      licenseId: record.licenseId,
      coverUrl: record.coverUrl ?? undefined,
      category: record.categories.map((novelCategory) =>
        novelCategory.category.name.toLowerCase(),
      ),
    };
  }
}

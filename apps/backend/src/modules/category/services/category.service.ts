import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategoryStatus, Prisma } from '@prisma/client';
import {
  CustomLoggerService,
  retryAsync,
} from 'nestjs-backend-common';

import {
  boundPagination,
  paginateConnection,
  PaginationArgs,
} from '../../../shared';
import { normalizeCategoryName } from '../../novel/utils';
import { PrismaService } from '../../prisma';
import {
  CATEGORIES_PAGE_SIZE_DEFAULT,
  CATEGORIES_PAGE_SIZE_MAX,
  CATEGORY_NAME_MAX_LENGTH,
} from '../constants';
import { CategoryFiltersInput } from '../inputs';
import {
  Category,
  CategoryConnection,
  DeleteCategoryResponse,
} from '../types';

const CATEGORY_SELECT = {
  id: true,
  name: true,
  status: true,
  requesterUserId: true,
} satisfies Prisma.CategorySelect;

/**
 * @description Prisma's `startsWith` hands the text to `LIKE` as is, so `%` and `_` in it would be wildcards.
 */
function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, '\\$&');
}

/**
 * @description
 * A name matches when it, or one of its words, starts with the text: `life` finds `slice of life` and `sci` finds `hard sci-fi`, but `ntas` does not find `fantasy`. Words are split by a space or a hyphen.
 */
function wordStartMatches(
  escapedText: string,
): Prisma.CategoryWhereInput[] {
  return [
    { name: { startsWith: escapedText, mode: 'insensitive' } },
    { name: { contains: ` ${escapedText}`, mode: 'insensitive' } },
    { name: { contains: `-${escapedText}`, mode: 'insensitive' } },
  ];
}

@Injectable()
export class CategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: CustomLoggerService,
  ) {}

  async findConnection(
    isAdmin: boolean,
    pagination: PaginationArgs,
    filters?: CategoryFiltersInput,
  ): Promise<CategoryConnection> {
    const page = boundPagination(pagination, {
      defaultSize: CATEGORIES_PAGE_SIZE_DEFAULT,
      maxSize: CATEGORIES_PAGE_SIZE_MAX,
    });
    const statuses =
      isAdmin && filters?.statuses?.length
        ? filters.statuses
        : [CategoryStatus.APPROVED];
    const where: Prisma.CategoryWhereInput = {
      status: { in: statuses },
      ...(filters?.search && {
        OR: wordStartMatches(escapeLikePattern(filters.search)),
      }),
    };
    const { edges, pageInfo } = await paginateConnection({
      pagination: page,
      findMany: ({ cursor, skip, take, shouldReverse }) =>
        this.prisma.category.findMany({
          where,
          orderBy: { name: shouldReverse ? 'desc' : 'asc' },
          select: CATEGORY_SELECT,
          cursor,
          skip,
          take,
        }),
      toNode: (row) => row,
    });

    return Object.assign(new CategoryConnection(), {
      edges,
      pageInfo,
    });
  }

  async request(
    requesterUserId: string,
    name: string,
  ): Promise<Category> {
    const normalized = this.normalize(name);
    // `skipDuplicates` (ON CONFLICT DO NOTHING) keeps two concurrent requests for one name from failing on the unique index.
    const { count } = await this.prisma.category.createMany({
      data: [
        {
          name: normalized,
          status: CategoryStatus.PENDING,
          requesterUserId,
        },
      ],
      skipDuplicates: true,
    });

    if (count === 0) {
      throw this.toAlreadyExists(normalized);
    }

    return this.prisma.category.findUniqueOrThrow({
      where: { name: normalized },
      select: CATEGORY_SELECT,
    });
  }

  async approve(id: string): Promise<Category> {
    await this.prisma.category.updateMany({
      where: { id, status: CategoryStatus.PENDING },
      data: { status: CategoryStatus.APPROVED },
    });

    const category = await this.prisma.category.findUnique({
      where: { id },
      select: CATEGORY_SELECT,
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async rename(id: string, name: string): Promise<Category> {
    const normalized = this.normalize(name);
    const [error, category] = await retryAsync(
      () =>
        this.prisma.category.update({
          where: { id },
          data: { name: normalized },
          select: CATEGORY_SELECT,
        }),
      { retry: 0 },
    );

    if (error) {
      throw this.toKnownError(error, normalized);
    }

    return category;
  }

  async delete(id: string): Promise<DeleteCategoryResponse> {
    const [error] = await retryAsync(
      () => this.prisma.category.delete({ where: { id } }),
      { retry: 0 },
    );

    if (error) {
      throw this.toKnownError(error);
    }

    return { id };
  }

  /**
   * @description
   * The planner's row estimate for the novels of each category, from `EXPLAIN` instead of `COUNT(*)`. `EXPLAIN` only plans the query, so its cost stays flat (about 0.2 ms) however many novels a category has, while `COUNT(*)` has to visit every matching row and grows with the category: orders of magnitude slower once categories hold hundreds of thousands of novels or more. The price is accuracy: the estimate is only as fresh as the table statistics (`ANALYZE`), and the planner never goes below 1. A category whose estimate cannot be read gets 0.
   */
  async estimateNovelCounts(
    categoryIds: string[],
  ): Promise<Map<string, number>> {
    const counts = await Promise.all(
      categoryIds.map(async (categoryId) => {
        const [error, count] = await retryAsync(
          () => this.explainNovelCount(categoryId),
          { retry: 0 },
        );

        if (error) {
          this.logger.warn(
            `Could not estimate the novels of category ${categoryId}: ${error}`,
          );
        }

        return [categoryId, error ? 0 : count] as const;
      }),
    );

    return new Map(counts);
  }

  private async explainNovelCount(
    categoryId: string,
  ): Promise<number> {
    const rows = await this.prisma.$queryRaw<
      { 'QUERY PLAN': { Plan: { 'Plan Rows': number } }[] }[]
    >(
      Prisma.sql`EXPLAIN (FORMAT JSON) SELECT 1 FROM novel_categories WHERE category_id = ${categoryId}::uuid`,
    );
    const estimate =
      rows[0]?.['QUERY PLAN']?.[0]?.Plan?.['Plan Rows'];

    if (typeof estimate !== 'number' || !Number.isFinite(estimate)) {
      throw new Error('The query plan has no row estimate');
    }

    return Math.max(0, Math.round(estimate));
  }

  private normalize(name: string): string {
    const normalized = normalizeCategoryName(name);

    if (normalized.length > CATEGORY_NAME_MAX_LENGTH) {
      throw new BadRequestException(
        `A category name can have at most ${CATEGORY_NAME_MAX_LENGTH} characters`,
      );
    }

    return normalized;
  }

  private toKnownError(error: unknown, name?: string): unknown {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return error;
    }

    if (error.code === 'P2025') {
      return new NotFoundException('Category not found');
    }

    if (error.code === 'P2002' && name) {
      return this.toAlreadyExists(name);
    }

    return error;
  }

  private toAlreadyExists(
    normalizedName: string,
  ): BadRequestException {
    return new BadRequestException(
      `The category "${normalizedName}" already exists or was already requested. Search for "${normalizedName}" instead.`,
    );
  }
}

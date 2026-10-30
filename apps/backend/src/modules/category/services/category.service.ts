import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategoryStatus, Prisma } from '@prisma/client';
import { isUUID } from 'class-validator';
import { PageInfo, retryAsync } from 'nestjs-backend-common';

import {
  buildCursorPaginationParams,
  PaginationArgs,
  trimCursorPaginationResults,
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
  CategoryEdge,
  DeleteCategoryResponse,
} from '../types';

const CATEGORY_SELECT = {
  id: true,
  name: true,
  status: true,
} satisfies Prisma.CategorySelect;

/**
 * @description Prisma's `contains` hands the text to `LIKE` as is, so `%` and `_` in it would be wildcards.
 */
function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, '\\$&');
}

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findConnection(
    isAdmin: boolean,
    pagination: PaginationArgs,
    filters?: CategoryFiltersInput,
  ): Promise<CategoryConnection> {
    const page = this.toBoundedPage(pagination);
    const status = isAdmin
      ? (filters?.status ?? CategoryStatus.APPROVED)
      : CategoryStatus.APPROVED;
    const where: Prisma.CategoryWhereInput = {
      status,
      ...(filters?.search && {
        name: {
          contains: escapeLikePattern(filters.search),
          mode: 'insensitive',
        },
      }),
    };
    const { cursor, skip, take, shouldReverse } =
      buildCursorPaginationParams(page);
    const rows = await this.prisma.category.findMany({
      where,
      orderBy: { name: shouldReverse ? 'desc' : 'asc' },
      select: CATEGORY_SELECT,
      cursor,
      skip,
      take,
    });
    const { items, hasMore } = trimCursorPaginationResults(
      rows,
      page,
      shouldReverse,
    );
    const edges: CategoryEdge[] = items.map((row) => ({
      cursor: Buffer.from(row.id).toString('base64'),
      node: row,
    }));
    const pageInfo: PageInfo = {
      startCursor: edges.length > 0 ? edges[0].cursor : null,
      endCursor:
        edges.length > 0 ? edges[edges.length - 1].cursor : null,
      hasPreviousPage: !!page.after,
      hasNextPage: hasMore && !!page.first,
    };
    const connection = new CategoryConnection();

    connection.edges = edges;
    connection.pageInfo = pageInfo;

    return connection;
  }

  async request(
    requestedById: string,
    name: string,
  ): Promise<Category> {
    const normalized = this.normalize(name);
    // `skipDuplicates` (ON CONFLICT DO NOTHING) keeps two concurrent requests for one name from failing on the unique index.
    const { count } = await this.prisma.category.createMany({
      data: [
        {
          name: normalized,
          status: CategoryStatus.PENDING,
          requestedById,
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

  /**
   * @description Without `first` or `last` the page would be every category, so a default applies; an oversized page is refused rather than silently cut.
   */
  private toBoundedPage(pagination: PaginationArgs): PaginationArgs {
    const { first, last, after, before } = pagination;

    for (const cursor of [after, before]) {
      if (
        cursor &&
        !isUUID(Buffer.from(cursor, 'base64').toString())
      ) {
        throw new BadRequestException('Invalid cursor');
      }
    }

    const requested = first ?? last;

    if (requested !== undefined && requested < 1) {
      throw new BadRequestException(
        'first and last must be at least 1',
      );
    }

    if (
      requested !== undefined &&
      requested > CATEGORIES_PAGE_SIZE_MAX
    ) {
      throw new BadRequestException(
        `first and last can be at most ${CATEGORIES_PAGE_SIZE_MAX}`,
      );
    }

    if (requested === undefined) {
      return { ...pagination, first: CATEGORIES_PAGE_SIZE_DEFAULT };
    }

    return pagination;
  }
}

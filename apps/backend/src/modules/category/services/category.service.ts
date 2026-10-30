import { BadRequestException, Injectable } from '@nestjs/common';
import { CategoryStatus, Prisma } from '@prisma/client';
import { isUUID } from 'class-validator';
import { PageInfo } from 'nestjs-backend-common';

import {
  buildCursorPaginationParams,
  PaginationArgs,
  trimCursorPaginationResults,
} from '../../../shared';
import { PrismaService } from '../../prisma';
import {
  CATEGORIES_PAGE_SIZE_DEFAULT,
  CATEGORIES_PAGE_SIZE_MAX,
} from '../constants';
import { CategoryFiltersInput } from '../inputs';
import { CategoryConnection, CategoryEdge } from '../types';

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
      select: { id: true, name: true, status: true },
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

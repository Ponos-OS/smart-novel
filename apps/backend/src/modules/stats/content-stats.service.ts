import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { toUtcDay } from '@smart-novel/shared';
import {
  CustomLoggerService,
  retryAsync,
} from 'nestjs-backend-common';

import {
  boundPagination,
  buildAudience,
  paginateConnection,
  PaginationArgs,
} from '../../shared';
import { CursorCodec } from '../cursor';
import { estimateRows, PrismaService } from '../prisma';
import {
  STATS_HISTORY_PAGE_SIZE_DEFAULT,
  STATS_HISTORY_PAGE_SIZE_MAX,
} from './constants';
import { StatsHistoryFiltersInput } from './inputs';
import {
  ContentStats,
  StatsSnapshot,
  StatsSnapshotConnection,
} from './types';

@Injectable()
export class ContentStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cursorCodec: CursorCodec,
    private readonly logger: CustomLoggerService,
  ) {}

  /**
   * @description Planner estimates through {@link estimateRows}, cheap enough for every page view. A figure that cannot be read is 0 and logged.
   */
  async findLiveTotals(): Promise<ContentStats> {
    const [estimatedNovelCount, estimatedChapterCount] =
      await Promise.all([
        this.estimateOrZero(
          'novels',
          Prisma.sql`SELECT 1 FROM novels`,
        ),
        this.estimateOrZero(
          'chapters',
          Prisma.sql`SELECT 1 FROM chapters`,
        ),
      ]);

    return Object.assign(new ContentStats(), {
      estimatedNovelCount,
      estimatedChapterCount,
    });
  }

  async findHistoryConnection(
    pagination: PaginationArgs,
    filters?: StatsHistoryFiltersInput,
  ): Promise<StatsSnapshotConnection> {
    const page = boundPagination(pagination, {
      defaultSize: STATS_HISTORY_PAGE_SIZE_DEFAULT,
      maxSize: STATS_HISTORY_PAGE_SIZE_MAX,
    });
    const from = filters?.from && toUtcDay(filters.from);
    const to = filters?.to && toUtcDay(filters.to);
    const where: Prisma.StatsSnapshotWhereInput = {
      ...((from || to) && {
        day: { ...(from && { gte: from }), ...(to && { lte: to }) },
      }),
    };
    const { edges, pageInfo } = await paginateConnection({
      codec: this.cursorCodec,
      audience: buildAudience('stats-snapshots', { where }),
      pagination: page,
      findMany: ({ cursor, skip, take, shouldReverse }) =>
        this.prisma.statsSnapshot.findMany({
          where,
          orderBy: { day: shouldReverse ? 'desc' : 'asc' },
          cursor,
          skip,
          take,
        }),
      toNode: (row): StatsSnapshot => ({
        id: row.id,
        day: row.day,
        novelCount: row.novelCount,
        chapterCount: row.chapterCount,
      }),
    });

    return Object.assign(new StatsSnapshotConnection(), {
      edges,
      pageInfo,
    });
  }

  private async estimateOrZero(
    table: string,
    query: Prisma.Sql,
  ): Promise<number> {
    const [error, estimate] = await retryAsync(
      () => estimateRows(this.prisma, query),
      { retry: 0 },
    );

    if (error) {
      this.logger.warn(`Could not estimate the ${table}: ${error}`);

      return 0;
    }

    return estimate;
  }
}

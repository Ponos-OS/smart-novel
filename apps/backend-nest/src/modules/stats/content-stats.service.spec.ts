import type { ConfigType } from '@nestjs/config';
import type { CustomLoggerService } from 'nestjs-backend-common';

import { BadRequestException } from '@nestjs/common';

import { appConfigs } from '../../app/configs/app.config';
import { CursorCodec } from '../cursor';
import { PrismaService } from '../prisma';
import { ContentStatsService } from './content-stats.service';

const planFor = (rows: number) => [
  { 'QUERY PLAN': [{ Plan: { 'Plan Rows': rows } }] },
];
const snapshot = (day: string, novelCount: number) => ({
  id: crypto.randomUUID(),
  day: new Date(day),
  novelCount,
  chapterCount: novelCount * 12,
  createdAt: new Date(`${day}T03:00:00.000Z`),
});

describe(ContentStatsService.name, () => {
  let uut: ContentStatsService;
  let prisma: {
    $queryRaw: ReturnType<typeof vi.fn>;
    statsSnapshot: { findMany: ReturnType<typeof vi.fn> };
  };
  let logger: { warn: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    prisma = {
      $queryRaw: vi.fn(),
      statsSnapshot: { findMany: vi.fn().mockResolvedValue([]) },
    };
    logger = { warn: vi.fn() };
    uut = new ContentStatsService(
      prisma as unknown as PrismaService,
      new CursorCodec({
        CURSOR_SIGNING_SECRET:
          'a-signing-secret-of-enough-length-1234',
      } as ConfigType<typeof appConfigs>),
      logger as unknown as CustomLoggerService,
    );
  });

  describe('findLiveTotals', () => {
    it('should return the planner estimates of both tables', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce(planFor(1204))
        .mockResolvedValueOnce(planFor(14231));

      const result = await uut.findLiveTotals();

      expect(result).toEqual({
        estimatedNovelCount: 1204,
        estimatedChapterCount: 14231,
      });
    });

    it('should give 0 and warn for a plan that cannot be read', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ 'QUERY PLAN': [] }])
        .mockResolvedValueOnce(planFor(14231));

      const result = await uut.findLiveTotals();

      expect(result).toEqual({
        estimatedNovelCount: 0,
        estimatedChapterCount: 14231,
      });
      expect(logger.warn).toHaveBeenCalledOnce();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('novels'),
      );
    });
  });

  describe('findHistoryConnection', () => {
    it('should read 30 days oldest first by default', async () => {
      await uut.findHistoryConnection({});

      expect(prisma.statsSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          orderBy: { day: 'asc' },
          take: 31,
        }),
      );
    });

    it('should turn the bounds into whole UTC days', async () => {
      await uut.findHistoryConnection(
        {},
        {
          from: new Date('2026-10-05T22:30:00.000Z'),
          to: new Date('2026-10-20T01:15:00.000Z'),
        },
      );

      expect(prisma.statsSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            day: {
              gte: new Date('2026-10-05T00:00:00.000Z'),
              lte: new Date('2026-10-20T00:00:00.000Z'),
            },
          },
        }),
      );
    });

    it('should return the newest days of `last` in ascending order', async () => {
      prisma.statsSnapshot.findMany.mockResolvedValue([
        snapshot('2026-10-31', 1204),
        snapshot('2026-10-30', 1198),
        snapshot('2026-10-29', 1190),
      ]);

      const result = await uut.findHistoryConnection({ last: 2 });

      expect(
        result.edges.map((edge) => edge.node.novelCount),
      ).toEqual([1198, 1204]);
      expect(prisma.statsSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { day: 'desc' } }),
      );
    });

    it('should refuse a page over the limit', async () => {
      const result = uut.findHistoryConnection({ first: 101 });

      await expect(result).rejects.toThrow(BadRequestException);
    });

    it('should refuse a cursor issued for another range', async () => {
      prisma.statsSnapshot.findMany.mockResolvedValue([
        snapshot('2026-10-29', 1190),
        snapshot('2026-10-30', 1198),
      ]);
      const { pageInfo } = await uut.findHistoryConnection(
        { first: 1 },
        { from: new Date('2026-10-01T00:00:00.000Z') },
      );

      const result = uut.findHistoryConnection(
        { first: 1, after: pageInfo.endCursor },
        { from: new Date('2026-10-10T00:00:00.000Z') },
      );

      await expect(result).rejects.toThrow(BadRequestException);
    });
  });
});

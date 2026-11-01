import type { ConfigType } from '@nestjs/config';
import type { SchedulerRegistry } from '@nestjs/schedule';
import type { CronJob } from 'cron';
import type { CustomLoggerService } from 'nestjs-backend-common';

import { appConfigs } from '../../app/configs/app.config';
import { PrismaService } from '../prisma';
import {
  STATS_SNAPSHOT_JOB,
  StatsSnapshotService,
} from './stats-snapshot.service';

describe(StatsSnapshotService.name, () => {
  let uut: StatsSnapshotService;
  let prisma: {
    statsSnapshot: Record<
      'findUnique' | 'createMany',
      ReturnType<typeof vi.fn>
    >;
    novel: { count: ReturnType<typeof vi.fn> };
    chapter: { count: ReturnType<typeof vi.fn> };
  };
  let logger: {
    log: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  let schedulerRegistry: { addCronJob: ReturnType<typeof vi.fn> };
  const jobs: CronJob[] = [];

  beforeEach(() => {
    prisma = {
      statsSnapshot: {
        findUnique: vi.fn().mockResolvedValue(null),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      novel: { count: vi.fn().mockResolvedValue(1204) },
      chapter: { count: vi.fn().mockResolvedValue(14231) },
    };
    logger = { log: vi.fn(), error: vi.fn() };
    schedulerRegistry = {
      addCronJob: vi.fn((_name: string, job: CronJob) =>
        jobs.push(job),
      ),
    };
    uut = new StatsSnapshotService(
      prisma as unknown as PrismaService,
      logger as unknown as CustomLoggerService,
      schedulerRegistry as unknown as SchedulerRegistry,
      { STATS_SNAPSHOT_CRON: '0 3 * * *' } as ConfigType<
        typeof appConfigs
      >,
    );
  });

  afterEach(() => {
    jobs.splice(0).forEach((job) => job.stop());
  });

  describe('takeSnapshot', () => {
    it('should count the novels and the chapters and write the row of the UTC day', async () => {
      const result = await uut.takeSnapshot(
        new Date('2026-11-01T03:00:00.000Z'),
      );

      expect(result).toBeTrue();
      expect(prisma.statsSnapshot.findUnique).toHaveBeenCalledWith({
        where: { day: new Date('2026-11-01T00:00:00.000Z') },
        select: { id: true },
      });
      expect(prisma.statsSnapshot.createMany).toHaveBeenCalledWith({
        data: [
          {
            day: new Date('2026-11-01T00:00:00.000Z'),
            novelCount: 1204,
            chapterCount: 14231,
          },
        ],
        skipDuplicates: true,
      });
      expect(logger.log).toHaveBeenCalledWith(
        'Stats snapshot of 2026-11-01: 1204 novels, 14231 chapters',
      );
    });

    it('should leave a day that already has its row alone, without even counting', async () => {
      prisma.statsSnapshot.findUnique.mockResolvedValue({ id: 'x' });

      const result = await uut.takeSnapshot(
        new Date('2026-11-01T03:00:00.000Z'),
      );

      expect(result).toBeFalse();
      expect(prisma.novel.count).not.toHaveBeenCalled();
      expect(prisma.chapter.count).not.toHaveBeenCalled();
      expect(prisma.statsSnapshot.createMany).not.toHaveBeenCalled();
    });

    it('should write nothing and say nothing when another instance wrote the day in the meantime', async () => {
      prisma.statsSnapshot.createMany.mockResolvedValue({ count: 0 });

      const result = await uut.takeSnapshot(
        new Date('2026-11-01T03:00:00.000Z'),
      );

      expect(result).toBeFalse();
      expect(logger.log).not.toHaveBeenCalled();
    });

    it.each([
      {
        scenario: 'the last millisecond of a UTC day',
        now: '2026-11-01T23:59:59.999Z',
        day: '2026-11-01T00:00:00.000Z',
      },
      {
        scenario: 'the first millisecond of the next one',
        now: '2026-11-02T00:00:00.000Z',
        day: '2026-11-02T00:00:00.000Z',
      },
      {
        scenario:
          'a moment that is already the next day where the server is, but not in UTC',
        now: '2026-11-02T01:30:00.000+02:00',
        day: '2026-11-01T00:00:00.000Z',
      },
    ])(
      'should use the UTC day for $scenario',
      async ({ now, day }) => {
        await uut.takeSnapshot(new Date(now));

        expect(prisma.statsSnapshot.findUnique).toHaveBeenCalledWith(
          expect.objectContaining({ where: { day: new Date(day) } }),
        );
      },
    );
  });

  describe('run', () => {
    it('should take the snapshot', async () => {
      await uut.run();

      expect(prisma.statsSnapshot.createMany).toHaveBeenCalledOnce();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should log a failure and never throw it', async () => {
      prisma.novel.count.mockRejectedValue(
        new Error('connection lost'),
      );

      await expect(uut.run()).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('connection lost'),
      );
    });
  });

  describe('onModuleInit', () => {
    it('should register a running job with the configured expression, in UTC', () => {
      uut.onModuleInit();

      const [name, job] = schedulerRegistry.addCronJob.mock
        .calls[0] as [string, CronJob];
      expect(name).toBe(STATS_SNAPSHOT_JOB);
      expect(job.cronTime.source).toBe('0 3 * * *');
      expect(job.cronTime.timeZone).toBe('UTC');
      expect(job.isActive).toBeTrue();
    });
  });

  describe('onApplicationBootstrap', () => {
    it('should take the missing day without holding the startup back', async () => {
      const result = uut.onApplicationBootstrap();

      expect(result).toBeUndefined();
      await vi.waitFor(() =>
        expect(
          prisma.statsSnapshot.createMany,
        ).toHaveBeenCalledOnce(),
      );
    });

    it('should not count again when the day is already there', async () => {
      prisma.statsSnapshot.findUnique.mockResolvedValue({ id: 'x' });

      uut.onApplicationBootstrap();

      await vi.waitFor(() =>
        expect(
          prisma.statsSnapshot.findUnique,
        ).toHaveBeenCalledOnce(),
      );
      expect(prisma.novel.count).not.toHaveBeenCalled();
    });
  });
});

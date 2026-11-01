import type { ConfigType } from '@nestjs/config';

import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import {
  CustomLoggerService,
  retryAsync,
} from 'nestjs-backend-common';

import { appConfigs } from '../../app/configs/app.config';
import { PrismaService } from '../prisma';

export const STATS_SNAPSHOT_JOB = 'stats-snapshot';

/**
 * @description
 * Writes exact counts, which is what the growth charts plot, at most once per UTC day (the first run of a day wins, later ones do nothing), so the schedule decides how many days have a row. The schedule is a required setting, so the job is registered at runtime from the validated value (a `@Cron` decorator is read before the configuration is loaded). A restart cannot leave a gap: at startup today's row is written if it is missing.
 */
@Injectable()
export class StatsSnapshotService
  implements OnModuleInit, OnApplicationBootstrap
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: CustomLoggerService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(appConfigs.KEY)
    private readonly appConfig: ConfigType<typeof appConfigs>,
  ) {}

  onModuleInit(): void {
    const job = CronJob.from({
      cronTime: this.appConfig.STATS_SNAPSHOT_CRON,
      onTick: () => this.run(),
      timeZone: 'UTC',
      start: true,
    });

    this.schedulerRegistry.addCronJob(STATS_SNAPSHOT_JOB, job);
  }

  /**
   * @description Not awaited: the counts of a large catalog take a while and must not hold the startup back.
   */
  onApplicationBootstrap(): void {
    void this.run();
  }

  /**
   * @description A failure is logged and never thrown: the next tick, or the next start, tries again.
   */
  async run(): Promise<void> {
    const [error] = await retryAsync(() => this.takeSnapshot(), {
      retry: 0,
    });

    if (error) {
      this.logger.error(
        `Could not take the stats snapshot: ${error}`,
      );
    }
  }

  /**
   * @description
   * Idempotent: a day that already has its row is left alone and not even counted, and the insert skips a duplicate, so a restart, a second replica or a retry never writes a day twice.
   *
   * @returns Whether this call wrote the row of the day
   */
  async takeSnapshot(now = new Date()): Promise<boolean> {
    const day = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
      ),
    );
    const existing = await this.prisma.statsSnapshot.findUnique({
      where: { day },
      select: { id: true },
    });

    if (existing) {
      return false;
    }

    const [novelCount, chapterCount] = await Promise.all([
      this.prisma.novel.count(),
      this.prisma.chapter.count(),
    ]);
    const { count } = await this.prisma.statsSnapshot.createMany({
      data: [{ day, novelCount, chapterCount }],
      skipDuplicates: true,
    });

    if (count > 0) {
      this.logger.log(
        `Stats snapshot of ${day.toISOString().slice(0, 10)}: ${novelCount} novels, ${chapterCount} chapters`,
      );
    }

    return count > 0;
  }
}

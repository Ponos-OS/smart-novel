import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { Role } from '@smart-novel/shared';

import { RequireRole } from '../auth';
import { ContentStatsService } from './content-stats.service';
import { StatsHistoryFiltersInput } from './inputs';
import { ContentStats, StatsSnapshotConnection } from './types';

@Resolver()
export class ContentStatsResolver {
  constructor(private readonly statsService: ContentStatsService) {}

  @RequireRole(Role.admin)
  @Query(() => ContentStats, {
    description:
      "Admin only. Today's totals of the whole catalog, as planner estimates (cheap, safe on every page view). They do not follow any list filter.",
  })
  async contentStats(): Promise<ContentStats> {
    return this.statsService.findLiveTotals();
  }

  @RequireRole(Role.admin)
  @Query(() => StatsSnapshotConnection, {
    description:
      'Admin only. The daily snapshots (exact counts), oldest day first. Without `first` or `last` a page of 30 is returned, at most 100 are allowed; `last: 30` is the newest 30 days, still in ascending order. A 400 when `filters.to` is before `filters.from`.',
  })
  async statsSnapshotsConnection(
    @Args('first', { type: () => Int, nullable: true })
    first?: number,
    @Args('last', { type: () => Int, nullable: true }) last?: number,
    @Args('after', { type: () => String, nullable: true })
    after?: string,
    @Args('before', { type: () => String, nullable: true })
    before?: string,
    @Args('filters', {
      type: () => StatsHistoryFiltersInput,
      nullable: true,
    })
    filters?: StatsHistoryFiltersInput,
  ): Promise<StatsSnapshotConnection> {
    return this.statsService.findHistoryConnection(
      { first, last, after, before },
      filters,
    );
  }
}

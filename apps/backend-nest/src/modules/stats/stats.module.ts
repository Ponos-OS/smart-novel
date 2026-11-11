import { Module } from '@nestjs/common';

import { ContentStatsResolver } from './content-stats.resolver';
import { ContentStatsService } from './content-stats.service';
import { StatsSnapshotService } from './stats-snapshot.service';

@Module({
  providers: [
    StatsSnapshotService,
    ContentStatsService,
    ContentStatsResolver,
  ],
  exports: [StatsSnapshotService],
})
export class StatsModule {}

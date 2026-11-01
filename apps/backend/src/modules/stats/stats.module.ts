import { Module } from '@nestjs/common';

import { StatsSnapshotService } from './stats-snapshot.service';

@Module({
  providers: [StatsSnapshotService],
  exports: [StatsSnapshotService],
})
export class StatsModule {}

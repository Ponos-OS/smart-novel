import { Global, Module } from '@nestjs/common';

import { BackgroundRunnerService } from './background-runner.service';

@Global()
@Module({
  providers: [BackgroundRunnerService],
  exports: [BackgroundRunnerService],
})
export class BackgroundRunnerModule {}

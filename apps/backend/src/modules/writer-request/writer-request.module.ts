import { Module } from '@nestjs/common';

import { WriterRequestResolver } from './writer-request.resolver';
import { WriterRequestService } from './writer-request.service';

@Module({
  providers: [WriterRequestResolver, WriterRequestService],
})
export class WriterRequestModule {}

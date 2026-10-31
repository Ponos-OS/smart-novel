import { Module } from '@nestjs/common';

import { ZitadelEventsController } from './zitadel-events.controller';
import { ZitadelSignatureGuard } from './zitadel-signature.guard';

@Module({
  controllers: [ZitadelEventsController],
  providers: [ZitadelSignatureGuard],
})
export class ZitadelEventsModule {}

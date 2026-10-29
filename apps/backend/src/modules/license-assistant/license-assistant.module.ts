import { Module } from '@nestjs/common';

import { LicenseAssistantResolver } from './license-assistant.resolver';
import { LicenseAssistantService } from './license-assistant.service';

@Module({
  providers: [LicenseAssistantResolver, LicenseAssistantService],
})
export class LicenseAssistantModule {}

import { Module } from '@nestjs/common';

import { LicenseDataLoader } from './dataloaders';
import { LicenseResolver } from './license.resolver';
import { LicenseService } from './services';

@Module({
  providers: [LicenseResolver, LicenseService, LicenseDataLoader],
  exports: [LicenseService, LicenseDataLoader],
})
export class LicenseModule {}

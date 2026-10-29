import { Module } from '@nestjs/common';

import { LicenseDataLoader } from './dataloaders';
import { LicenseFieldResolver } from './license.field-resolver';
import { LicenseResolver } from './license.resolver';
import { LicenseService } from './services';

@Module({
  providers: [
    LicenseResolver,
    LicenseFieldResolver,
    LicenseService,
    LicenseDataLoader,
  ],
  exports: [LicenseService, LicenseDataLoader],
})
export class LicenseModule {}

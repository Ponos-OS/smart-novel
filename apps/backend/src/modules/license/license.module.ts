import { Module } from '@nestjs/common';

import { LicenseDataLoader } from './dataloaders';
import { LicenseDraftResolver } from './license-draft.resolver';
import { LicenseFieldResolver } from './license.field-resolver';
import { LicenseResolver } from './license.resolver';
import { LicenseDraftService, LicenseService } from './services';

@Module({
  providers: [
    LicenseResolver,
    LicenseFieldResolver,
    LicenseDraftResolver,
    LicenseService,
    LicenseDraftService,
    LicenseDataLoader,
  ],
  exports: [LicenseService, LicenseDataLoader],
})
export class LicenseModule {}

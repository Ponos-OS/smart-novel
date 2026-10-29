import { Module } from '@nestjs/common';

import { LicenseResolver } from './license.resolver';
import { LicenseService } from './services';

@Module({
  providers: [LicenseResolver, LicenseService],
  exports: [LicenseService],
})
export class LicenseModule {}

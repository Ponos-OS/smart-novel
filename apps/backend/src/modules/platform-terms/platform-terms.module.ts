import { Global, Module } from '@nestjs/common';

import {
  PLATFORM_TERMS,
  PLATFORM_TERMS_FILE_PATH,
} from './platform-terms.constants';
import { PlatformTermsGuard } from './platform-terms.guard';
import { PlatformTermsResolver } from './platform-terms.resolver';
import { PlatformTermsService } from './platform-terms.service';
import { loadPlatformTerms } from './utils';

@Global()
@Module({
  providers: [
    PlatformTermsResolver,
    PlatformTermsService,
    PlatformTermsGuard,
    {
      // A missing file or a bad version fails the boot.
      provide: PLATFORM_TERMS,
      useFactory: () => loadPlatformTerms(PLATFORM_TERMS_FILE_PATH),
    },
  ],
  exports: [PlatformTermsService, PlatformTermsGuard],
})
export class PlatformTermsModule {}

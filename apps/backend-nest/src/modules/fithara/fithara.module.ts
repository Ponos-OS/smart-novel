import type { ConfigType } from '@nestjs/config';

import { Global, Module } from '@nestjs/common';
import ms from 'ms';

import { appConfigs } from '../../app/configs/app.config';
import { createFitharaClient } from '../../shared';
import { CanonicalLicenseCatalog } from './canonical-license-catalog.service';
import { FITHARA_CLIENT } from './constants';

@Global()
@Module({
  providers: [
    CanonicalLicenseCatalog,
    {
      provide: FITHARA_CLIENT,
      inject: [appConfigs.KEY],
      useFactory: (appConfig: ConfigType<typeof appConfigs>) =>
        createFitharaClient({
          baseUrl: appConfig.FITHARA_URL,
          timeoutMs: ms(appConfig.FITHARA_TIMEOUT),
        }),
    },
  ],
  exports: [FITHARA_CLIENT, CanonicalLicenseCatalog],
})
export class FitharaModule {}

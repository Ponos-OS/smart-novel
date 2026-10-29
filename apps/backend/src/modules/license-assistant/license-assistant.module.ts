import type { ConfigType } from '@nestjs/config';

import { Module } from '@nestjs/common';
import ms from 'ms';

import { appConfigs } from '../../app/configs/app.config';
import { createFitharaClient } from '../../shared';
import { FITHARA_CLIENT } from './constants';
import { LicenseAssistantResolver } from './license-assistant.resolver';
import { LicenseAssistantService } from './license-assistant.service';

@Module({
  providers: [
    LicenseAssistantResolver,
    LicenseAssistantService,
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
})
export class LicenseAssistantModule {}

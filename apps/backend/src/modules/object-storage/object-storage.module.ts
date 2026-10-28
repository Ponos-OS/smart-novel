import { Module } from '@nestjs/common';

import { ConfigurableModuleClass } from './object-storage.module-definition';
import {
  PUBLIC_S3_CLIENT_PROVIDER,
  S3_CLIENT_PROVIDER,
} from './providers';
import { ObjectStorageService } from './services';

@Module({
  providers: [
    S3_CLIENT_PROVIDER,
    PUBLIC_S3_CLIENT_PROVIDER,
    ObjectStorageService,
  ],
  exports: [S3_CLIENT_PROVIDER, ObjectStorageService],
})
export class ObjectStorageModule extends ConfigurableModuleClass {}

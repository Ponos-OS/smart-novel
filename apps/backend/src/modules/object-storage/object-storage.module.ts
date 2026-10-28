import { Module } from '@nestjs/common';

import { ConfigurableModuleClass } from './object-storage.module-definition';
import { S3_CLIENT_PROVIDER } from './providers';
import {
  ObjectDeleterService,
  PresignedUploadUrlService,
} from './services';

@Module({
  providers: [
    S3_CLIENT_PROVIDER,
    PresignedUploadUrlService,
    ObjectDeleterService,
  ],
  exports: [
    S3_CLIENT_PROVIDER,
    PresignedUploadUrlService,
    ObjectDeleterService,
  ],
})
export class ObjectStorageModule extends ConfigurableModuleClass {}

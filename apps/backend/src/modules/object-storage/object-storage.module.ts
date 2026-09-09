import { Module } from '@nestjs/common';

import { ConfigurableModuleClass } from './object-storage.module-definition';
import { S3_CLIENT_PROVIDER } from './providers';
import { PresignedUploadUrlService } from './services';

@Module({
  providers: [S3_CLIENT_PROVIDER, PresignedUploadUrlService],
  exports: [S3_CLIENT_PROVIDER, PresignedUploadUrlService],
})
export class ObjectStorageModule extends ConfigurableModuleClass {}

import type { ConfigType } from '@nestjs/config';

import { Inject, Injectable } from '@nestjs/common';

import {
  ObjectStorageModuleOptions,
  ObjectStorageModuleOptionsFactory,
} from '../../modules';
import { appConfigs } from './app.config';

@Injectable()
export class ObjectStorageModuleConfig implements ObjectStorageModuleOptionsFactory {
  constructor(
    @Inject(appConfigs.KEY)
    private readonly appConfig: ConfigType<typeof appConfigs>,
  ) {}

  create():
    | ObjectStorageModuleOptions
    | Promise<ObjectStorageModuleOptions> {
    return {
      region: this.appConfig.OBJECT_STORAGE_REGION,
      endpoint: this.appConfig.OBJECT_STORAGE_ENDPOINT,
      publicEndpoint: this.appConfig.OBJECT_STORAGE_PUBLIC_URL,
      accessKeyId: this.appConfig.OBJECT_STORAGE_ACCESS_KEY,
      secretAccessKey: this.appConfig.OBJECT_STORAGE_SECRET_KEY,
      enableLogger: this.appConfig.NODE_ENV === 'development',
      forcePathStyle: this.appConfig.NODE_ENV === 'development',
    };
  }
}

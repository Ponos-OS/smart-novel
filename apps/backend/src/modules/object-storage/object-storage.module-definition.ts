import {
  ConfigurableModuleBuilder,
  ConfigurableModuleOptionsFactory,
} from '@nestjs/common';
// Keep your CommonModuleOptions if you need extras like { global }
import { CommonModuleOptions } from 'nestjs-backend-common';

export interface ObjectStorageModuleOptions {
  /**
   * @description region is required when using AWS; can be arbitrary with custom endpoints (e.g., RustFS/Localstack).
   */
  region: string;

  /** @description Optional custom endpoint (e.g., http://localhost:4566 for Localstack, http://s3:9000 for RustFS). */
  endpoint?: string;

  /** @description Preferred credential field names */
  accessKeyId?: string;
  secretAccessKey?: string;

  /**
   * @description When using non-AWS S3 compatible storages, path-style is commonly needed.
   * If not provided, we default to `true` when `endpoint` is set.
   */
  forcePathStyle?: boolean;

  /**
   * @description If true, pass `console` to AWS SDK v3 as logger (very verbose).
   * @default false
   */
  enableLogger?: boolean;
}
export type ExtraObjectStorageModuleOptions = CommonModuleOptions;
export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  ASYNC_OPTIONS_TYPE,
  OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<ObjectStorageModuleOptions>()
  .setClassMethodName('register')
  .setFactoryMethodName('create')
  .setExtras<ExtraObjectStorageModuleOptions>(
    { global: false },
    (definition, extras) => ({
      ...definition,
      global: extras.global,
    }),
  )
  .build();
export type ObjectStorageModuleOptionsFactory =
  ConfigurableModuleOptionsFactory<
    ObjectStorageModuleOptions,
    'create'
  >;

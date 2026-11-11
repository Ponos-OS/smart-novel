import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';
import { Provider } from '@nestjs/common';
import { isNotEmpty } from 'class-validator';

import {
  MODULE_OPTIONS_TOKEN,
  ObjectStorageModuleOptions,
} from '../object-storage.module-definition';

function createS3Client(
  options: ObjectStorageModuleOptions,
  endpoint: string | undefined,
): S3Client {
  const config: S3ClientConfig = {
    region: options.region,
  };

  if (options.enableLogger === true) {
    config.logger = console;
  }

  if (
    isNotEmpty(options.accessKeyId) &&
    isNotEmpty(options.secretAccessKey)
  ) {
    config.credentials = {
      accessKeyId: options.accessKeyId!,
      secretAccessKey: options.secretAccessKey!,
    };
  }

  if (isNotEmpty(endpoint)) {
    config.endpoint = endpoint;
    // Default true for non-AWS endpoints unless explicitly set
    config.forcePathStyle = options.forcePathStyle ?? true;
  } else if (typeof options.forcePathStyle === 'boolean') {
    config.forcePathStyle = options.forcePathStyle;
  }

  return new S3Client(config);
}

export const S3_CLIENT_PROVIDER: Provider = {
  provide: S3Client,
  useFactory: (options: ObjectStorageModuleOptions) =>
    createS3Client(options, options.endpoint),
  inject: [MODULE_OPTIONS_TOKEN],
};

export const PUBLIC_S3_CLIENT = Symbol('PUBLIC_S3_CLIENT');

/**
 * @description Only signs: the browser, not the backend, sends the requests made with it.
 */
export const PUBLIC_S3_CLIENT_PROVIDER: Provider = {
  provide: PUBLIC_S3_CLIENT,
  useFactory: (options: ObjectStorageModuleOptions) =>
    createS3Client(
      options,
      options.publicEndpoint ?? options.endpoint,
    ),
  inject: [MODULE_OPTIONS_TOKEN],
};

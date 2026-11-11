import { Inject } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';

import {
  RedisModuleOptions,
  RedisModuleOptionsFactory,
} from '../../modules';
import { appConfigs } from './app.config';

export class RedisModuleConfig implements RedisModuleOptionsFactory {
  constructor(
    @Inject(appConfigs.KEY)
    private readonly appConfig: ConfigType<typeof appConfigs>,
  ) {}

  create(): Promise<RedisModuleOptions> | RedisModuleOptions {
    return {
      redisUrl: this.appConfig.REDIS_URL,
      redisPassword: this.appConfig.REDIS_PASSWORD,
    };
  }
}

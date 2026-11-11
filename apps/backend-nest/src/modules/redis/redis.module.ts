import { Module } from '@nestjs/common';

import { ConfigurableModuleClass } from './redis.module-definition';
import { CacheService, RedisService } from './services';

@Module({
  providers: [RedisService, CacheService],
  exports: [RedisService, CacheService],
})
export class RedisModule extends ConfigurableModuleClass {}

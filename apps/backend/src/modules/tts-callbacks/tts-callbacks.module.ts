import { Module } from '@nestjs/common';

import {
  GenUploadUrlController,
  StatusCallbackController,
} from './controllers';
import { BeatriceTokenGuard } from './guards';

/**
 * @description
 * REST endpoints Beatrice calls into during a `generateAudio` job: `genUploadUrl`
 * and `statusCallbackUrl`.
 *
 * `AUTH_PROVIDER`, `PresignedUploadUrlService`, and `RedisService` come from
 * `AuthModule`/`ObjectStorageModule`/`RedisModule`, all registered `global: true`
 * in `AppModule` — no need to import them here.
 */
@Module({
  controllers: [GenUploadUrlController, StatusCallbackController],
  providers: [BeatriceTokenGuard],
})
export class TtsCallbacksModule {}

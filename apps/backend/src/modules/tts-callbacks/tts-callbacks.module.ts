import { Module } from '@nestjs/common';

import { GenUploadUrlController } from './controllers';
import { BeatriceTokenGuard } from './guards';

/**
 * @description
 * REST endpoints Beatrice calls into during a `generateAudio` job: `genUploadUrl`
 * (this module) and, later, `statusCallbackUrl`.
 *
 * `AUTH_PROVIDER` and `PresignedUploadUrlService` come from `AuthModule`/`ObjectStorageModule`,
 * both registered `global: true` in `AppModule` — no need to import them here.
 */
@Module({
  controllers: [GenUploadUrlController],
  providers: [BeatriceTokenGuard],
})
export class TtsCallbacksModule {}

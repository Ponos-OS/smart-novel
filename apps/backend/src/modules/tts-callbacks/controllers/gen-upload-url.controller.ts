import type { ConfigType } from '@nestjs/config';

import {
  BadRequestException,
  Controller,
  Headers,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';

import { appConfigs } from '../../../app/configs/app.config';
import { Public } from '../../auth';
import { PresignedUploadUrlService } from '../../object-storage';
import { TTS_AUDIO_OBJECT_KEY_PREFIX } from '../constants';
import { BeatriceTokenGuard } from '../guards';

interface GenUploadUrlResponse {
  url: string;
}

/** @description Beatrice's `jobId` — the only value it ever sends as `Idempotency-Key` — is a UUID. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller('beatrice-callbacks')
export class GenUploadUrlController {
  /** @description Short-lived by design — Beatrice uses the URL once, right after requesting it. */
  private static readonly PRESIGNED_URL_TTL_SECONDS = 5 * 60;
  private static readonly CONTENT_TYPE = 'audio/mpeg';

  constructor(
    private readonly presignedUploadUrlService: PresignedUploadUrlService,
    @Inject(appConfigs.KEY)
    private readonly appConfig: ConfigType<typeof appConfigs>,
  ) {}

  /**
   * @description
   * Beatrice's `genUploadUrl` callback. Guarded by {@link BeatriceTokenGuard} instead of
   * the global `JwtAuthGuard` — `@Public()` opts this route out of the global guard's
   * strict (expiration-enforcing) token validation.
   */
  @Public()
  @UseGuards(BeatriceTokenGuard)
  @Post('gen-upload-url')
  async genUploadUrl(
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<GenUploadUrlResponse> {
    if (!idempotencyKey) {
      throw new BadRequestException('Missing Idempotency-Key header');
    }

    // Reject anything that isn't a bare UUID before it becomes part of the object key —
    // otherwise a caller-controlled header could inject `/`/`..` segments into the S3 key.
    if (!UUID_PATTERN.test(idempotencyKey)) {
      throw new BadRequestException('Idempotency-Key must be a UUID');
    }

    const objectKey = `${TTS_AUDIO_OBJECT_KEY_PREFIX}/${idempotencyKey}.mp3`;
    const url = await this.presignedUploadUrlService.generate(
      this.appConfig.OBJECT_STORAGE_BUCKET,
      objectKey,
      GenUploadUrlController.CONTENT_TYPE,
      GenUploadUrlController.PRESIGNED_URL_TTL_SECONDS,
    );

    return { url };
  }
}

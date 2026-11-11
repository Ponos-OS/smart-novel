import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { CustomLoggerService } from 'nestjs-backend-common';

import { Public } from '../../auth';
import { RedisService } from '../../redis';
import { TTS_STATUS_CHANNEL } from '../constants';
import { TtsStatusCallbackDto } from '../dtos';

@Controller('beatrice-callbacks')
export class StatusCallbackController {
  constructor(
    private readonly redisService: RedisService,
    private readonly logger: CustomLoggerService,
  ) {}

  /**
   * @description
   * Beatrice's `statusCallbackUrl` callback — best-effort, no response body expected.
   * Malformed bodies are rejected with 400 by the global `ValidationPipe`. Valid ones
   * are republished as-is on {@link TTS_STATUS_CHANNEL}; no subscriber wiring yet
   * (that's Step 2.1/2.2).
   */
  @Public()
  @Post('status')
  @HttpCode(HttpStatus.NO_CONTENT)
  async statusCallback(
    @Body() body: TtsStatusCallbackDto,
  ): Promise<void> {
    this.logger.log(
      `Received "${body.status}" status callback for job ${body.jobId} (chapter ${body.clientContextId ?? 'unknown'})`,
      { context: StatusCallbackController.name },
    );

    await this.redisService.publish(
      TTS_STATUS_CHANNEL,
      JSON.stringify(body),
    );
  }
}

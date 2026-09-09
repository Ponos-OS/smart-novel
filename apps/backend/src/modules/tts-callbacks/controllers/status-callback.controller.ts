import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';

import { Public } from '../../auth';
import { RedisService } from '../../redis';
import { TTS_STATUS_CHANNEL } from '../constants';
import { TtsStatusCallbackDto } from '../dtos';

@Controller('beatrice-callbacks')
export class StatusCallbackController {
  constructor(private readonly redisService: RedisService) {}

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
    await this.redisService.publish(
      TTS_STATUS_CHANNEL,
      JSON.stringify(body),
    );
  }
}

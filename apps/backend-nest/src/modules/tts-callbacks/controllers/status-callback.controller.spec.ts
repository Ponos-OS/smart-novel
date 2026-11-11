import type { CustomLoggerService } from 'nestjs-backend-common';

import type { RedisService } from '../../redis';

import { TTS_STATUS_CHANNEL } from '../constants';
import { TtsStatusCallbackDto } from '../dtos';
import { StatusCallbackController } from './status-callback.controller';

describe(StatusCallbackController.name, () => {
  let uut: StatusCallbackController;
  let redisService: RedisService;
  let logger: CustomLoggerService;

  beforeEach(() => {
    redisService = {
      publish: vi.fn(),
    } as any;
    logger = {
      log: vi.fn(),
    } as any;

    uut = new StatusCallbackController(redisService, logger);
  });

  it('should publish the payload as-is on the TTS status channel', async () => {
    const body: TtsStatusCallbackDto = {
      jobId: '2bce49d6-6592-4ed3-b421-f913b9ecc3bd',
      status: 'completed',
      fileSizeBytes: 4,
      attempt: 1,
    };

    await uut.statusCallback(body);

    expect(redisService.publish).toHaveBeenCalledWith(
      TTS_STATUS_CHANNEL,
      JSON.stringify(body),
    );
  });

  it('should log the status, jobId, and clientContextId of every callback received', async () => {
    const body: TtsStatusCallbackDto = {
      jobId: '2bce49d6-6592-4ed3-b421-f913b9ecc3bd',
      status: 'generating',
      clientContextId: 'e8cec22d-a2c2-4f68-ac1c-6a3cdbbfef33',
      attempt: 1,
    };

    await uut.statusCallback(body);

    expect(logger.log).toHaveBeenCalledWith(
      'Received "generating" status callback for job 2bce49d6-6592-4ed3-b421-f913b9ecc3bd (chapter e8cec22d-a2c2-4f68-ac1c-6a3cdbbfef33)',
      { context: StatusCallbackController.name },
    );
  });

  it('should log "unknown" when the callback carries no clientContextId', async () => {
    const body: TtsStatusCallbackDto = {
      jobId: '2bce49d6-6592-4ed3-b421-f913b9ecc3bd',
      status: 'queued',
    };

    await uut.statusCallback(body);

    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('(chapter unknown)'),
      expect.any(Object),
    );
  });
});

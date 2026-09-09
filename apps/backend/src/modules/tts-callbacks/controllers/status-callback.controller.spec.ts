import type { RedisService } from '../../redis';

import { TTS_STATUS_CHANNEL } from '../constants';
import { TtsStatusCallbackDto } from '../dtos';
import { StatusCallbackController } from './status-callback.controller';

describe(StatusCallbackController.name, () => {
  let uut: StatusCallbackController;
  let redisService: RedisService;

  beforeEach(() => {
    redisService = {
      publish: vi.fn(),
    } as any;

    uut = new StatusCallbackController(redisService);
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
});

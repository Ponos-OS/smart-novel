import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { TtsStatusCallbackDto } from './tts-status-callback.dto';

describe(TtsStatusCallbackDto.name, () => {
  it.each([
    { status: 'queued' },
    {
      status: 'queued',
      clientContextId: 'e8cec22d-a2c2-4f68-ac1c-6a3cdbbfef33',
    },
    { status: 'generating' },
    { status: 'uploading' },
    { status: 'completed', fileSizeBytes: 128_000, attempt: 1 },
    {
      status: 'failed',
      failedAt: '2026-09-09T12:00:00.000Z',
      error: { code: 'TTS_PROVIDER_ERROR', message: 'boom' },
    },
  ])(
    'should accept a valid $status payload',
    async ({ status, ...rest }) => {
      const dto = plainToInstance(TtsStatusCallbackDto, {
        jobId: '2bce49d6-6592-4ed3-b421-f913b9ecc3bd',
        status,
        ...rest,
      });

      const errors = await validate(dto);

      expect(errors).toBeArrayOfSize(0);
    },
  );

  it.each([
    ['missing jobId', { status: 'queued' }],
    ['non-UUID jobId', { jobId: 'not-a-uuid', status: 'queued' }],
    [
      'missing status',
      { jobId: '2bce49d6-6592-4ed3-b421-f913b9ecc3bd' },
    ],
    [
      'unknown status value',
      {
        jobId: '2bce49d6-6592-4ed3-b421-f913b9ecc3bd',
        status: 'done',
      },
    ],
    [
      'non-string clientContextId',
      {
        jobId: '2bce49d6-6592-4ed3-b421-f913b9ecc3bd',
        status: 'queued',
        clientContextId: 123,
      },
    ],
    [
      'malformed nested error',
      {
        jobId: '2bce49d6-6592-4ed3-b421-f913b9ecc3bd',
        status: 'failed',
        error: { code: 'TTS_PROVIDER_ERROR' },
      },
    ],
  ])('should reject a payload with %s', async (_name, payload) => {
    const dto = plainToInstance(TtsStatusCallbackDto, payload);

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});

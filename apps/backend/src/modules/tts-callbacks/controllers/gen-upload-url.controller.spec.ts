import { BadRequestException } from '@nestjs/common';

import type { PresignedUploadUrlService } from '../../object-storage';

import { GenUploadUrlController } from './gen-upload-url.controller';

describe(GenUploadUrlController.name, () => {
  let uut: GenUploadUrlController;
  let presignedUploadUrlService: PresignedUploadUrlService;
  const appConfig = {
    OBJECT_STORAGE_BUCKET: 'beatrice-local',
  } as any;

  beforeEach(() => {
    presignedUploadUrlService = {
      generate: vi.fn(),
    } as any;

    uut = new GenUploadUrlController(
      presignedUploadUrlService,
      appConfig,
    );
  });

  it('should throw BadRequestException when the Idempotency-Key header is missing', async () => {
    await expect(uut.genUploadUrl(undefined)).rejects.toThrow(
      BadRequestException,
    );
    expect(presignedUploadUrlService.generate).not.toHaveBeenCalled();
  });

  it('should return the presigned URL for a deterministic, jobId-scoped object key', async () => {
    const jobId = '2bce49d6-6592-4ed3-b421-f913b9ecc3bd';
    vi.mocked(presignedUploadUrlService.generate).mockResolvedValue(
      'https://s3.example.com/beatrice-local/tts-audio/2bce49d6-6592-4ed3-b421-f913b9ecc3bd.mp3?X-Amz-Signature=abc',
    );

    const result = await uut.genUploadUrl(jobId);

    expect(result).toEqual({
      url: 'https://s3.example.com/beatrice-local/tts-audio/2bce49d6-6592-4ed3-b421-f913b9ecc3bd.mp3?X-Amz-Signature=abc',
    });
    expect(presignedUploadUrlService.generate).toHaveBeenCalledWith(
      'beatrice-local',
      'tts-audio/2bce49d6-6592-4ed3-b421-f913b9ecc3bd.mp3',
      'audio/mpeg',
      5 * 60,
    );
  });
});

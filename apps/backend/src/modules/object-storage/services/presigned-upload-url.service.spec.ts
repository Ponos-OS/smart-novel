import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { PresignedUploadUrlService } from './presigned-upload-url.service';

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(),
}));

describe(PresignedUploadUrlService.name, () => {
  const s3Client = {} as any;
  let uut: PresignedUploadUrlService;

  beforeEach(() => {
    vi.clearAllMocks();
    uut = new PresignedUploadUrlService(s3Client);
  });

  it('should return the signed URL scoped to the given bucket, key, content type, and TTL', async () => {
    vi.mocked(getSignedUrl).mockResolvedValue(
      'https://s3.example.com/beatrice-local/narrations/job-1.mp3?X-Amz-Signature=abc123',
    );

    const url = await uut.generate(
      'beatrice-local',
      'narrations/job-1.mp3',
      'audio/mpeg',
      300,
    );

    expect(url).toBe(
      'https://s3.example.com/beatrice-local/narrations/job-1.mp3?X-Amz-Signature=abc123',
    );
    expect(getSignedUrl).toHaveBeenCalledWith(
      s3Client,
      expect.any(PutObjectCommand),
      { expiresIn: 300 },
    );

    const command = vi.mocked(getSignedUrl).mock
      .calls[0][1] as PutObjectCommand;
    expect(command.input).toEqual({
      Bucket: 'beatrice-local',
      Key: 'narrations/job-1.mp3',
      ContentType: 'audio/mpeg',
    });
  });
});

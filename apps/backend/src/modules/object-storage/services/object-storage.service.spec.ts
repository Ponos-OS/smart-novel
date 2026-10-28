import {
  DeleteObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { ObjectStorageService } from './object-storage.service';

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(),
}));

describe(ObjectStorageService.name, () => {
  const coverKey =
    'covers/78981754-46c4-4521-9216-b9b27dafeab2/5c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f.png';
  let uut: ObjectStorageService;
  let s3Client: S3Client;
  let publicS3Client: S3Client;

  beforeEach(() => {
    vi.clearAllMocks();
    s3Client = { send: vi.fn() } as any;
    publicS3Client = { name: 'public' } as any;

    uut = new ObjectStorageService(s3Client, publicS3Client);
  });

  describe('generateUploadUrl', () => {
    it('should return the signed URL scoped to the given bucket, key, content type, and TTL', async () => {
      vi.mocked(getSignedUrl).mockResolvedValue(
        'https://s3.example.com/beatrice-local/narrations/job-1.mp3?X-Amz-Signature=abc123',
      );

      const url = await uut.generateUploadUrl(
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
        ContentLength: undefined,
      });
    });

    it('should sign the content length too when one is given', async () => {
      await uut.generateUploadUrl(
        'smart-novel',
        coverKey,
        'image/png',
        300,
        204800,
      );

      const [, command, options] =
        vi.mocked(getSignedUrl).mock.calls[0];
      expect((command as PutObjectCommand).input.ContentLength).toBe(
        204800,
      );
      expect(options).toEqual({
        expiresIn: 300,
        signableHeaders: new Set(['content-type', 'content-length']),
      });
    });
  });

  describe('generateBrowserUploadUrl', () => {
    it('should sign with the client of the browser-reachable endpoint', async () => {
      await uut.generateBrowserUploadUrl(
        'smart-novel',
        coverKey,
        'image/png',
        300,
        204800,
      );

      expect(vi.mocked(getSignedUrl).mock.calls[0][0]).toBe(
        publicS3Client,
      );
    });
  });

  describe('head', () => {
    it('should return the content type and length of an existing object', async () => {
      vi.mocked(s3Client.send).mockResolvedValue({
        ContentType: 'image/png',
        ContentLength: 204800,
      } as never);

      const result = await uut.head('smart-novel', coverKey);

      expect(result).toEqual({
        contentType: 'image/png',
        contentLength: 204800,
      });
      const command = vi.mocked(s3Client.send).mock
        .calls[0][0] as HeadObjectCommand;
      expect(command.input).toEqual({
        Bucket: 'smart-novel',
        Key: coverKey,
      });
    });

    it('should return null when the object does not exist', async () => {
      vi.mocked(s3Client.send).mockRejectedValue(
        new NotFound({ message: 'NotFound', $metadata: {} }),
      );

      const result = await uut.head('smart-novel', coverKey);

      expect(result).toBeNull();
    });

    it('should propagate any other storage error', async () => {
      vi.mocked(s3Client.send).mockRejectedValue(
        new Error('AccessDenied'),
      );

      const result = uut.head('smart-novel', coverKey);

      await expect(result).rejects.toThrow('AccessDenied');
    });
  });

  describe('delete', () => {
    it('should send a DeleteObject command for the bucket and key', async () => {
      await uut.delete(
        'smart-novel',
        'narrations/0b6b3d0e-5d0e-4d58-9f0b-3f1c7d6a2e11.mp3',
      );

      const command = vi.mocked(s3Client.send).mock
        .calls[0][0] as DeleteObjectCommand;
      expect(command).toBeInstanceOf(DeleteObjectCommand);
      expect(command.input).toEqual({
        Bucket: 'smart-novel',
        Key: 'narrations/0b6b3d0e-5d0e-4d58-9f0b-3f1c7d6a2e11.mp3',
      });
    });

    it('should propagate storage errors', async () => {
      vi.mocked(s3Client.send).mockRejectedValue(
        new Error('AccessDenied'),
      );

      const result = uut.delete('smart-novel', 'a.mp3');

      await expect(result).rejects.toThrow('AccessDenied');
    });
  });
});

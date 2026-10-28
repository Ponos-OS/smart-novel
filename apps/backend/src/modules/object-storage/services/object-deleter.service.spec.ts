import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { ObjectDeleterService } from './object-deleter.service';

describe(ObjectDeleterService.name, () => {
  let uut: ObjectDeleterService;
  let s3Client: S3Client;

  beforeEach(() => {
    s3Client = { send: vi.fn() } as any;

    uut = new ObjectDeleterService(s3Client);
  });

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

    await expect(uut.delete('smart-novel', 'a.mp3')).rejects.toThrow(
      'AccessDenied',
    );
  });
});

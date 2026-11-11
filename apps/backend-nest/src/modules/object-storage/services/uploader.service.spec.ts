import {
  AbortMultipartUploadCommand,
  ChecksumAlgorithm,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  PutObjectCommand,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { InternalServerErrorException } from '@nestjs/common';

import { UploaderService } from './uploader.service';

describe(UploaderService.name, () => {
  const filename = 'file.txt';
  const objectKey = 'path/file.txt';
  const bucketName = 'bucket';
  const logger = { verbose: vi.fn() } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use a single PUT upload (no multipart) WITHOUT checksum', async () => {
    const s3 = {
      send: vi.fn().mockResolvedValueOnce({}),
    } as any;
    const uut = new UploaderService(
      s3,
      filename,
      objectKey,
      bucketName,
      logger,
      undefined, // checksumAlgorithm not set
    );

    const data = new Uint8Array([1, 2, 3]);

    await uut.upload(
      data,
      true /* isLastChunk */,
      undefined /* checksum */,
    );

    expect(s3.send).toHaveBeenCalledTimes(1);
    const cmd = vi.mocked(s3.send).mock.calls[0][0];
    expect(cmd).toBeInstanceOf(PutObjectCommand);
    const input = getCommandInput<PutObjectCommand>(cmd);
    expect(input).toEqual(
      expect.objectContaining({
        Bucket: bucketName,
        Key: objectKey,
        Body: data,
      }),
    );
    // Ensure checksum-related fields are absent
    expect(input).not.toHaveProperty('ChecksumAlgorithm');
    expect(input).not.toHaveProperty('ChecksumCRC32');
    expect(input).not.toHaveProperty('ChecksumSHA256');
  });

  it('should use a single PUT upload (no multipart) WITH checksum + algorithm', async () => {
    const s3 = {
      send: vi.fn().mockResolvedValueOnce({}),
    } as any;
    const checksumAlgorithm = ChecksumAlgorithm.CRC32;
    const checksum = 'i9aeUg==';
    const uut = new UploaderService(
      s3,
      filename,
      objectKey,
      bucketName,
      logger,
      checksumAlgorithm,
    );
    const data = new Uint8Array([9, 9, 9]);

    await uut.upload(data, true, checksum);

    expect(s3.send).toHaveBeenCalledTimes(1);
    const cmd = vi.mocked(s3.send).mock.calls[0][0];
    expect(cmd).toBeInstanceOf(PutObjectCommand);
    const input = getCommandInput<PutObjectCommand>(cmd);
    expect(input).toEqual(
      expect.objectContaining({
        Bucket: bucketName,
        Key: objectKey,
        Body: data,
        ChecksumAlgorithm: checksumAlgorithm,
        // dynamic property name: "Checksum" + algorithm (e.g. ChecksumCRC32)
        ChecksumCRC32: checksum,
      }),
    );
  });

  it('should use multipart upload WITHOUT checksum (create -> uploadPart -> uploadPart -> complete without checksum fields)', async () => {
    const uploadId =
      '2~FHz6zP1yXKqvZK19jFZ8D7U4M3wTn6pPZzKJxwY8lM0bA0q4T4rJ6cQe9rK';
    const s3 = {
      send: vi
        .fn()
        .mockResolvedValueOnce({ UploadId: uploadId }) // createMultipartUpload
        .mockResolvedValueOnce({
          ETag: '"7f3b45e2c8d91a0be64f73ac91b2ef12-1"',
        }) // uploadPart #1
        .mockResolvedValueOnce({
          ETag: '"a81d92e77cfa0d3e66b9a54cbd9e9114-2"',
        }) // uploadPart #2
        .mockResolvedValueOnce({}), // completeMultipartUpload
    } as any;
    const uut = new UploaderService(
      s3,
      filename,
      objectKey,
      bucketName,
      logger,
      undefined, // <= IMPORTANT: no checksumAlgorithm
    );
    const bigChunk = new Uint8Array(5 * 1024 * 1024 + 1);
    const smallLastChunk = new Uint8Array([10, 20, 30]);

    await uut.upload(bigChunk, false); // First upload: big chunk, not last → create + uploadPart #1
    await uut.upload(smallLastChunk, true); // Second upload: small last chunk → uploadPart #2 + complete

    expect(s3.send).toHaveBeenCalledTimes(4);
    // 1) CreateMultipartUploadCommand — no checksum fields
    const createCmd = vi.mocked(s3.send).mock.calls[0][0];
    expect(createCmd).toBeInstanceOf(CreateMultipartUploadCommand);
    const createInput =
      getCommandInput<CreateMultipartUploadCommand>(createCmd);
    expect(createInput).toEqual(
      expect.objectContaining({
        Bucket: bucketName,
        Key: objectKey,
      }),
    );
    expect(createInput).not.toHaveProperty('ChecksumAlgorithm');
    expect(createInput).not.toHaveProperty('ChecksumType');
    // 2) UploadPartCommand #1
    const part1Cmd = vi.mocked(s3.send).mock.calls[1][0];
    expect(part1Cmd).toBeInstanceOf(UploadPartCommand);
    expect(getCommandInput<UploadPartCommand>(part1Cmd)).toEqual(
      expect.objectContaining({
        Bucket: bucketName,
        Key: objectKey,
        UploadId: uploadId,
        PartNumber: 1,
      }),
    );
    // 3) UploadPartCommand #2
    const part2Cmd = vi.mocked(s3.send).mock.calls[2][0];
    expect(part2Cmd).toBeInstanceOf(UploadPartCommand);
    expect(getCommandInput<UploadPartCommand>(part2Cmd)).toEqual(
      expect.objectContaining({
        Bucket: bucketName,
        Key: objectKey,
        UploadId: uploadId,
        PartNumber: 2,
      }),
    );
    // 4) CompleteMultipartUploadCommand — no checksum fields
    const completeCmd = vi.mocked(s3.send).mock.calls[3][0];
    expect(completeCmd).toBeInstanceOf(
      CompleteMultipartUploadCommand,
    );
    const completeInput =
      getCommandInput<CompleteMultipartUploadCommand>(completeCmd);
    expect(completeInput).toEqual(
      expect.objectContaining({
        Bucket: bucketName,
        Key: objectKey,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: [
            {
              PartNumber: 1,
              ETag: '"7f3b45e2c8d91a0be64f73ac91b2ef12-1"',
            },
            {
              PartNumber: 2,
              ETag: '"a81d92e77cfa0d3e66b9a54cbd9e9114-2"',
            },
          ],
        },
      }),
    );
    expect(completeInput).not.toHaveProperty('ChecksumType');
    expect(completeInput).not.toHaveProperty('ChecksumCRC32');
    expect(completeInput).not.toHaveProperty('ChecksumSHA256');
  });

  it('should use multipart upload WITH checksum (create includes checksum config; complete includes full-object checksum)', async () => {
    const uploadId = 'mp-upload-with-checksum';
    const checksumAlgorithm = ChecksumAlgorithm.CRC32;
    const fullObjectChecksum = 'abcd1234==';
    const s3 = {
      send: vi
        .fn()
        .mockResolvedValueOnce({ UploadId: uploadId }) // createMultipartUpload
        .mockResolvedValueOnce({
          ETag: '"7f3b45e2c8d91a0be64f73ac91b2ef12-5"',
          ChecksumCRC32: 'partCrc1==',
        }) // uploadPart #1
        .mockResolvedValueOnce({
          ETag: '"a81d92e77cfa0d3e66b9a54cbd9e9114-12"',
          ChecksumCRC32: 'partCrc2==',
        }) // uploadPart #2
        .mockResolvedValueOnce({}), // completeMultipartUpload
    } as any;
    const uut = new UploaderService(
      s3,
      filename,
      objectKey,
      bucketName,
      logger,
      checksumAlgorithm,
    );
    const bigChunk = new Uint8Array(5 * 1024 * 1024 + 1);
    const smallLastChunk = new Uint8Array([99]);

    await uut.upload(bigChunk, false); // First upload: big chunk, not last → create + uploadPart #1
    await uut.upload(smallLastChunk, true, fullObjectChecksum); // Second upload: small last chunk with full-object checksum → uploadPart #2 + complete

    expect(s3.send).toHaveBeenCalledTimes(4);
    // 1) CreateMultipartUploadCommand — includes checksum config
    const createCmd = vi.mocked(s3.send).mock.calls[0][0];
    expect(createCmd).toBeInstanceOf(CreateMultipartUploadCommand);
    const createInput =
      getCommandInput<CreateMultipartUploadCommand>(createCmd);
    expect(createInput).toEqual(
      expect.objectContaining({
        Bucket: bucketName,
        Key: objectKey,
        ChecksumAlgorithm: checksumAlgorithm,
        ChecksumType: 'FULL_OBJECT',
      }),
    );
    // 2) UploadPartCommand #1
    const part1Cmd = vi.mocked(s3.send).mock.calls[1][0];
    expect(part1Cmd).toBeInstanceOf(UploadPartCommand);
    expect(getCommandInput<UploadPartCommand>(part1Cmd)).toEqual(
      expect.objectContaining({
        PartNumber: 1,
        UploadId: uploadId,
      }),
    );
    // 3) UploadPartCommand #2
    const part2Cmd = vi.mocked(s3.send).mock.calls[2][0];
    expect(part2Cmd).toBeInstanceOf(UploadPartCommand);
    expect(getCommandInput<UploadPartCommand>(part2Cmd)).toEqual(
      expect.objectContaining({
        PartNumber: 2,
        UploadId: uploadId,
      }),
    );
    // 4) CompleteMultipartUploadCommand — includes full-object checksum
    const completeCmd = vi.mocked(s3.send).mock.calls[3][0];
    expect(completeCmd).toBeInstanceOf(
      CompleteMultipartUploadCommand,
    );
    const completeInput =
      getCommandInput<CompleteMultipartUploadCommand>(completeCmd);
    expect(completeInput).toEqual(
      expect.objectContaining({
        Bucket: bucketName,
        Key: objectKey,
        UploadId: uploadId,
        ChecksumType: 'FULL_OBJECT',
        ChecksumCRC32: fullObjectChecksum,
        MultipartUpload: {
          Parts: [
            {
              PartNumber: 1,
              ETag: '"7f3b45e2c8d91a0be64f73ac91b2ef12-5"',
              ChecksumCRC32: 'partCrc1==',
            },
            {
              PartNumber: 2,
              ETag: '"a81d92e77cfa0d3e66b9a54cbd9e9114-12"',
              ChecksumCRC32: 'partCrc2==',
            },
          ],
        },
      }),
    );
  });

  it('should do nothing if not multipart', async () => {
    const s3 = {
      send: vi.fn(),
    } as any;
    const uut = new UploaderService(
      s3,
      filename,
      objectKey,
      bucketName,
      logger,
    );

    await uut.abortUpload();

    expect(s3.send).not.toHaveBeenCalled();
  });

  it('should send AbortMultipartUploadCommand when multipart started', async () => {
    const s3 = {
      send: vi
        .fn()
        .mockResolvedValueOnce({ UploadId: 'u-3' }) // create
        .mockResolvedValueOnce({ ETag: '"etag-1"' }), // uploadPart
    } as any;
    const uut = new UploaderService(
      s3,
      filename,
      objectKey,
      bucketName,
      logger,
    );
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    await uut.upload(big, false); // not last, but big enough => create + uploadPart
    (s3.send as any).mockResolvedValueOnce({}); // abort response

    await uut.abortUpload();

    const abortCmd = vi.mocked(s3.send).mock.calls.at(-1)![0];
    expect(abortCmd).toBeInstanceOf(AbortMultipartUploadCommand);
    expect(
      getCommandInput<AbortMultipartUploadCommand>(abortCmd),
    ).toEqual(
      expect.objectContaining({
        Bucket: bucketName,
        Key: objectKey,
        UploadId: 'u-3',
      }),
    );
  });

  it('should throw if createMultipartUpload returns missing UploadId', async () => {
    const s3 = {
      send: vi.fn().mockResolvedValueOnce({}),
    } as any;
    const uut = new UploaderService(
      s3,
      filename,
      objectKey,
      bucketName,
      logger,
    );
    const big = new Uint8Array(5 * 1024 * 1024 + 1);

    await expect(uut.upload(big, false)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});

function getCommandInput<T extends { input: any }>(
  cmd: any,
): T['input'] {
  return cmd.input;
}

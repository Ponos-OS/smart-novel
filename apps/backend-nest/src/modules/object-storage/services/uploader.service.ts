import {
  AbortMultipartUploadCommand,
  ChecksumAlgorithm,
  CompletedPart,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { InternalServerErrorException } from '@nestjs/common';
import assert from 'assert';
import { isNotEmpty } from 'class-validator';
import mime from 'mime';
import { CustomLoggerService, isNil } from 'nestjs-backend-common';

import { appendUint8Array } from '../utils';

export class UploaderService {
  private uploadId?: string;
  private parts: CompletedPart[] = [];
  private chunk: Uint8Array | undefined;
  private _isMultipart = false;

  constructor(
    private readonly s3Client: S3Client,
    private readonly filename: string,
    private readonly objectKey: string,
    private readonly bucketName: string,
    private readonly logger: CustomLoggerService,
    private readonly checksumAlgorithm?: ChecksumAlgorithm,
  ) {}

  async upload(
    chunk: Uint8Array,
    isLastChunk: boolean,
    checksum?: string,
  ) {
    if (!this.chunk) {
      this.chunk = chunk;
    } else {
      this.chunk = appendUint8Array(this.chunk, chunk);
    }

    if (isLastChunk && !this._isMultipart) {
      const command = new PutObjectCommand({
        Body: this.chunk,
        Key: this.objectKey,
        Bucket: this.bucketName,
        ...(isNotEmpty(checksum) && {
          [`Checksum` + this.checksumAlgorithm]: checksum,
        }),
        ...(isNotEmpty(this.checksumAlgorithm) && {
          ChecksumAlgorithm: this.checksumAlgorithm,
        }),
      });

      await this.s3Client.send(command);

      return;
    }

    if (this.isChunkBigEnough()) {
      if (!this.uploadId) {
        await this.createMultipartUpload();
      }

      await this.uploadPart();
    }

    if (isLastChunk) {
      if (this.chunk) {
        await this.uploadPart();
      }

      await this.completeMultipartUpload(checksum!);
    }
  }

  async abortUpload() {
    if (!this._isMultipart) {
      return;
    }

    const command = new AbortMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: this.objectKey,
      UploadId: this.uploadId,
    });

    await this.s3Client.send(command);
  }

  private async completeMultipartUpload(checksum?: string) {
    const command = new CompleteMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: this.objectKey,
      UploadId: this.uploadId,
      ...(isNotEmpty(checksum) && {
        ChecksumType: 'FULL_OBJECT',
        [`Checksum` + this.checksumAlgorithm]: checksum,
      }),
      MultipartUpload: { Parts: this.parts },
    });

    await this.s3Client.send(command);
  }

  private async createMultipartUpload() {
    this.logger.verbose(
      `Initiate multipart upload (bucket: ${this.bucketName}, key: ${this.objectKey}, filename: ${this.filename})!`,
      { context: UploaderService.name },
    );

    const contentType = mime.getType(this.filename);
    const command = new CreateMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: this.objectKey,
      ...(this.checksumAlgorithm && {
        ChecksumAlgorithm: this.checksumAlgorithm,
        ChecksumType: 'FULL_OBJECT',
      }),
      ContentType: isNil(contentType) ? 'unknown' : contentType,
      ContentDisposition: `attachment; filename="${this.filename}"`,
    });
    const response = await this.s3Client.send(command);

    if (!response.UploadId) {
      throw new InternalServerErrorException('UploadId is missing');
    }

    this.uploadId = response.UploadId;
    this._isMultipart = true;
  }

  private async uploadPart() {
    const partNumber = this.parts.length + 1;

    this.logger.verbose(
      `Upload part #${partNumber} (upload ID: ${this.uploadId})`,
      { context: UploaderService.name },
    );

    const command = new UploadPartCommand({
      Bucket: this.bucketName,
      Key: this.objectKey,
      UploadId: this.uploadId,
      PartNumber: partNumber,
      Body: this.chunk,
    });
    const response = await this.s3Client.send(command);

    this.parts.push({
      PartNumber: partNumber,
      ETag: response.ETag,
      ...(response.ChecksumCRC32 && {
        ChecksumCRC32: response.ChecksumCRC32,
      }),
      ...(response.ChecksumCRC32C && {
        ChecksumCRC32C: response.ChecksumCRC32C,
      }),
    });
    this.chunk = undefined;
  }

  /** @description AWS S3 accepts parts bigger than 5MB */
  private isChunkBigEnough() {
    const sizeInMegabyte = 1024 * 1024 * 5;

    assert(this.chunk, 'Chunk is undefined');

    return this.chunk.length > sizeInMegabyte;
  }
}

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PresignedUploadUrlService {
  constructor(private readonly s3Client: S3Client) {}

  /**
   * @description
   * Presigned `PUT` URL for uploading a single object directly to the bucket. Short-lived by design — callers that hold the URL past `ttlSeconds` must request a new one.
   */
  async generate(
    bucketName: string,
    objectKey: string,
    contentType: string,
    ttlSeconds: number,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      ContentType: contentType,
    });

    return getSignedUrl(this.s3Client, command, {
      expiresIn: ttlSeconds,
    });
  }
}

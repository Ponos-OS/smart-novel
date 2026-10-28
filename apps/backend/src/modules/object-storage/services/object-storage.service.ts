import {
  DeleteObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable } from '@nestjs/common';

import { PUBLIC_S3_CLIENT } from '../providers';

export interface ObjectMetadata {
  contentType?: string;
  contentLength?: number;
}

@Injectable()
export class ObjectStorageService {
  constructor(
    private readonly s3Client: S3Client,
    @Inject(PUBLIC_S3_CLIENT)
    private readonly publicS3Client: S3Client,
  ) {}

  /**
   * @description
   * Presigned `PUT` URL for uploading a single object directly to the bucket, for callers inside the cluster. Short-lived by design — callers that hold the URL past `ttlSeconds` must request a new one. When `contentLength` is given it is part of the signature, so the bucket rejects a body of any other size.
   */
  async generateUploadUrl(
    bucketName: string,
    objectKey: string,
    contentType: string,
    ttlSeconds: number,
    contentLength?: number,
  ): Promise<string> {
    return this.sign(
      this.s3Client,
      bucketName,
      objectKey,
      contentType,
      ttlSeconds,
      contentLength,
    );
  }

  /**
   * @description Same as {@link generateUploadUrl}, but signed for the endpoint a browser reaches the bucket on.
   */
  async generateBrowserUploadUrl(
    bucketName: string,
    objectKey: string,
    contentType: string,
    ttlSeconds: number,
    contentLength?: number,
  ): Promise<string> {
    return this.sign(
      this.publicS3Client,
      bucketName,
      objectKey,
      contentType,
      ttlSeconds,
      contentLength,
    );
  }

  /**
   * @returns `null` when the object does not exist.
   */
  async head(
    bucketName: string,
    objectKey: string,
  ): Promise<ObjectMetadata | null> {
    try {
      const { ContentType, ContentLength } = await this.s3Client.send(
        new HeadObjectCommand({ Bucket: bucketName, Key: objectKey }),
      );

      return {
        contentType: ContentType,
        contentLength: ContentLength,
      };
    } catch (error) {
      if (error instanceof NotFound) {
        return null;
      }

      throw error;
    }
  }

  async delete(bucketName: string, objectKey: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({ Bucket: bucketName, Key: objectKey }),
    );
  }

  private async sign(
    client: S3Client,
    bucketName: string,
    objectKey: string,
    contentType: string,
    ttlSeconds: number,
    contentLength?: number,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      ContentType: contentType,
      ContentLength: contentLength,
    });

    return getSignedUrl(client, command, {
      expiresIn: ttlSeconds,
      // The signer leaves `content-length` unsigned unless asked to sign it.
      ...(contentLength !== undefined && {
        signableHeaders: new Set(['content-type', 'content-length']),
      }),
    });
  }
}

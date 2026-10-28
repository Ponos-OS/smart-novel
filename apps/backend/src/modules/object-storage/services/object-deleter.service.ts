import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ObjectDeleterService {
  constructor(private readonly s3Client: S3Client) {}

  async delete(bucketName: string, objectKey: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({ Bucket: bucketName, Key: objectKey }),
    );
  }
}

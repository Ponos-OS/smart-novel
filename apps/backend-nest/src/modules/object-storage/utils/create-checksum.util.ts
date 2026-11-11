import { ChecksumAlgorithm } from '@aws-sdk/client-s3';
import { checksums } from 'aws-crt';
import { createHash, Hash } from 'crypto';

type StreamChecksum = {
  update(chunk: Buffer): void;
  digestBase64(): string;
};

function u32beBase64(n: number): string {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0, 0); // ensure unsigned
  return b.toString('base64');
}

export function createChecksum(
  algorithm: ChecksumAlgorithm,
): StreamChecksum {
  switch (algorithm) {
    case 'CRC32': {
      let sum = 0;
      return {
        update(chunk: Buffer) {
          // aws-crt crc32 supports incremental by passing previous value
          sum = checksums.crc32(chunk, sum);
        },
        digestBase64() {
          return u32beBase64(sum);
        },
      };
    }

    case 'CRC32C': {
      let sum = 0;
      return {
        update(chunk: Buffer) {
          // aws-crt crc32c supports incremental by passing previous value
          sum = checksums.crc32c(chunk, sum);
        },
        digestBase64() {
          return u32beBase64(sum);
        },
      };
    }

    case 'SHA1':
    case 'SHA256': {
      const nodeAlg = algorithm.toLowerCase() as 'sha1' | 'sha256';
      const h: Hash = createHash(nodeAlg);
      return {
        update(chunk: Buffer) {
          h.update(chunk);
        },
        digestBase64() {
          return h.digest('base64');
        },
      };
    }

    default:
      throw new Error(`Unsupported checksum algorithm: ${algorithm}`);
  }
}

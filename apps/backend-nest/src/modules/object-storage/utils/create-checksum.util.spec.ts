import { ChecksumAlgorithm } from '@aws-sdk/client-s3';

import { createChecksum } from './create-checksum.util';

describe(createChecksum.name, () => {
  describe('CRC32', () => {
    it('should compute CRC32 checksum for a single chunk', () => {
      // Arrange
      const data = Buffer.from('hello world');

      // Act
      const checksum = createChecksum('CRC32' as ChecksumAlgorithm);
      checksum.update(data);
      const result = checksum.digestBase64();

      // Assert
      expect(result).toBe('DUoRhQ==');
    });

    it('should compute CRC32 checksum for incremental updates', () => {
      // Act
      const checksum = createChecksum('CRC32' as ChecksumAlgorithm);
      checksum.update(Buffer.from('hello'));
      checksum.update(Buffer.from(' '));
      checksum.update(Buffer.from('world'));
      const result = checksum.digestBase64();

      // Assert
      expect(result).toBe('DUoRhQ==');
    });

    it('should compute checksum for empty buffer', () => {
      // Act
      const checksum = createChecksum('CRC32' as ChecksumAlgorithm);
      checksum.update(Buffer.from(''));
      const result = checksum.digestBase64();

      // Assert
      expect(result).toBe('AAAAAA==');
    });

    it('should NOT mutate the input buffer', () => {
      const checksum = createChecksum('CRC32' as ChecksumAlgorithm);
      const data = Buffer.from('test');
      const originalData = Buffer.from(data);

      checksum.update(data);

      expect(data.equals(originalData)).toBeTrue();
    });
  });

  describe('CRC32C', () => {
    it('should compute CRC32C checksum for a single chunk', () => {
      // Arrange
      const data = Buffer.from('hello world');

      // Act
      const checksum = createChecksum('CRC32C' as ChecksumAlgorithm);
      checksum.update(data);
      const result = checksum.digestBase64();

      // Assert
      expect(result).toBe('yZRlqg==');
    });

    it('should compute CRC32C checksum for incremental updates', () => {
      // Act
      const checksum = createChecksum('CRC32C' as ChecksumAlgorithm);
      checksum.update(Buffer.from('hello'));
      checksum.update(Buffer.from(' '));
      checksum.update(Buffer.from('world'));
      const result = checksum.digestBase64();

      // Assert
      expect(result).toBe('yZRlqg==');
    });

    it('should compute checksum for empty buffer', () => {
      // Act
      const checksum = createChecksum('CRC32C' as ChecksumAlgorithm);
      checksum.update(Buffer.from(''));
      const result = checksum.digestBase64();

      // Assert
      expect(result).toBe('AAAAAA==');
    });

    it('should NOT mutate the input buffer', () => {
      // Act
      const checksum = createChecksum('CRC32C' as ChecksumAlgorithm);
      const data = Buffer.from('test');
      const originalData = Buffer.from(data);
      checksum.update(data);

      // Assert
      expect(data.equals(originalData)).toBeTrue();
    });
  });

  describe('SHA1', () => {
    it('should compute SHA1 checksum for a single chunk', () => {
      // Arrange
      const data = Buffer.from('hello world');

      // Act
      const checksum = createChecksum('SHA1' as ChecksumAlgorithm);
      checksum.update(data);
      const result = checksum.digestBase64();

      // Assert
      expect(result).toBe('Kq5sNclPz7QV2+lfQIuc6R7oRu0=');
    });

    it('should compute SHA1 checksum for incremental updates', () => {
      // Act
      const checksum = createChecksum('SHA1' as ChecksumAlgorithm);
      checksum.update(Buffer.from('hello'));
      checksum.update(Buffer.from(' '));
      checksum.update(Buffer.from('world'));
      const result = checksum.digestBase64();

      // Assert
      expect(result).toBe('Kq5sNclPz7QV2+lfQIuc6R7oRu0=');
    });

    it('should compute checksum for empty buffer', () => {
      // Act
      const checksum = createChecksum('SHA1' as ChecksumAlgorithm);
      checksum.update(Buffer.from(''));
      const result = checksum.digestBase64();

      // Assert
      expect(result).toBe('2jmj7l5rSw0yVb/vlWAYkK/YBwk=');
    });

    it('should NOT mutate the input buffer', () => {
      // Act
      const checksum = createChecksum('SHA1' as ChecksumAlgorithm);
      const data = Buffer.from('test');
      const originalData = Buffer.from(data);
      checksum.update(data);

      // Assert
      expect(data.equals(originalData)).toBe(true);
    });
  });

  describe('SHA256', () => {
    it('should compute SHA256 checksum for a single chunk', () => {
      // Arrange
      const data = Buffer.from('hello world');

      // Act
      const checksum = createChecksum('SHA256' as ChecksumAlgorithm);
      checksum.update(data);
      const result = checksum.digestBase64();

      // Assert
      expect(result).toBe(
        'uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek=',
      );
    });

    it('should compute SHA256 checksum for incremental updates', () => {
      // Act
      const checksum = createChecksum('SHA256' as ChecksumAlgorithm);
      checksum.update(Buffer.from('hello'));
      checksum.update(Buffer.from(' '));
      checksum.update(Buffer.from('world'));
      const result = checksum.digestBase64();

      // Assert
      expect(result).toBe(
        'uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek=',
      );
    });

    it('should compute checksum for empty buffer', () => {
      // Act
      const checksum = createChecksum('SHA256' as ChecksumAlgorithm);
      checksum.update(Buffer.from(''));
      const result = checksum.digestBase64();

      // Assert
      expect(result).toBe(
        '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=',
      );
    });

    it('should NOT mutate the input buffer', () => {
      // Act
      const checksum = createChecksum('SHA256' as ChecksumAlgorithm);
      const data = Buffer.from('test');
      const originalData = Buffer.from(data);
      checksum.update(data);

      // Assert
      expect(data.equals(originalData)).toBe(true);
    });
  });

  it.each<any>(['UNSUPPORTED', null, undefined])(
    'should throw error for %j algorithm',
    (algorithm) => {
      expect(() => {
        createChecksum(algorithm);
      }).toThrow(`Unsupported checksum algorithm: ${algorithm}`);
    },
  );

  it('should return object with update and digestBase64 methods', () => {
    const checksum = createChecksum('SHA256' as ChecksumAlgorithm);

    expect(typeof checksum.update).toBe('function');
    expect(typeof checksum.digestBase64).toBe('function');
  });
});

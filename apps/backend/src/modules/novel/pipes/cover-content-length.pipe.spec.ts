import { BadRequestException } from '@nestjs/common';

import { CoverContentLengthPipe } from './cover-content-length.pipe';

describe(CoverContentLengthPipe.name, () => {
  let uut: CoverContentLengthPipe;

  beforeEach(() => {
    uut = new CoverContentLengthPipe();
  });

  it.each([1, 204800, 5 * 1024 * 1024])(
    'should return %d untouched',
    (contentLength) => {
      const result = uut.transform(contentLength);

      expect(result).toBe(contentLength);
    },
  );

  it.each([0, -1, 5 * 1024 * 1024 + 1, 10.5, Number.NaN])(
    'should throw BadRequestException for %d',
    (contentLength) => {
      expect(() => uut.transform(contentLength)).toThrow(
        new BadRequestException(
          'Cover must be between 1 byte and 5242880 bytes',
        ),
      );
    },
  );
});

import { BadRequestException } from '@nestjs/common';

import { CoverContentTypePipe } from './cover-content-type.pipe';

describe(CoverContentTypePipe.name, () => {
  let uut: CoverContentTypePipe;

  beforeEach(() => {
    uut = new CoverContentTypePipe();
  });

  it.each(['image/jpeg', 'image/png', 'image/webp'])(
    'should return %s untouched',
    (contentType) => {
      const result = uut.transform(contentType);

      expect(result).toBe(contentType);
    },
  );

  it.each([
    'image/gif',
    'text/html',
    'IMAGE/PNG',
    '',
    'constructor',
    'toString',
  ])('should throw BadRequestException for %s', (contentType) => {
    expect(() => uut.transform(contentType)).toThrow(
      new BadRequestException(
        'Cover must be one of: image/jpeg, image/png, image/webp',
      ),
    );
  });
});

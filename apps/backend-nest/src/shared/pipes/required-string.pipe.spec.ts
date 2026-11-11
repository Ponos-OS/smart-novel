import { BadRequestException } from '@nestjs/common';

import { RequiredStringPipe } from './required-string.pipe';

describe(RequiredStringPipe.name, () => {
  let pipe: RequiredStringPipe;

  beforeEach(() => {
    pipe = new RequiredStringPipe();
  });

  it.each<string>([' Hello me ', ' Hello me', 'Hello me '])(
    'should return trimmed string if input is a non-empty string',
    (input) => {
      const result = pipe.transform(input, {} as any);

      expect(result).toBe('Hello me');
    },
  );

  it.each<any>([null, undefined, '', '   '])(
    'should throw BadRequestException if input is null, undefined, empty string or whitespace',
    (input) => {
      expect(() => pipe.transform(input, {} as any)).toThrow(
        new BadRequestException('String cannot be empty'),
      );
    },
  );
});

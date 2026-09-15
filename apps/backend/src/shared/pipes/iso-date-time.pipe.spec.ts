import { BadRequestException } from '@nestjs/common';

import { IsoDateTimePipe } from './iso-date-time.pipe';

describe(IsoDateTimePipe.name, () => {
  let pipe: IsoDateTimePipe;

  beforeEach(() => {
    pipe = new IsoDateTimePipe();
  });

  it.each<string>([
    '2026-09-16T10:00:00.000Z',
    '2026-09-16T10:00:00Z',
    '2026-09-16',
  ])(
    'should return the value unchanged for a valid ISO 8601 string %s',
    (input) => {
      const result = pipe.transform(input);

      expect(result).toBe(input);
    },
  );

  it.each<any>(['not-a-date', '09/16/2026', '', null, undefined])(
    'should throw BadRequestException for a non-ISO-8601 value %s',
    (input) => {
      expect(() => pipe.transform(input)).toThrow(
        new BadRequestException(
          `Invalid ISO 8601 timestamp: ${input}`,
        ),
      );
    },
  );
});

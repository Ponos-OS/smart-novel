import { BadRequestException } from '@nestjs/common';

import { ParseUuidPipe } from './parse-uuid.pipe';

describe(ParseUuidPipe.name, () => {
  let uut: ParseUuidPipe;

  beforeEach(() => {
    uut = new ParseUuidPipe();
  });

  describe('single value', () => {
    it('should return the value if UUID is valid', () => {
      const result = uut.transform(
        '023ab224-a7e9-47e9-b2e3-2e88c2b9f085',
      );

      expect(result).toBe('023ab224-a7e9-47e9-b2e3-2e88c2b9f085');
    });

    it.each(['invalid uuid', '69dfc7b1317d29f4befe6452'])(
      'should throw BadRequestException if UUID is invalid',
      (invalidUuid) => {
        expect(() => uut.transform(invalidUuid)).toThrow(
          new BadRequestException(`Invalid UUID: ${invalidUuid}`),
        );
      },
    );
  });

  describe('array of values', () => {
    it('should return the array if all UUIDs are valid', () => {
      const values = [
        '37d0bde4-c708-446a-8f5e-f7a191f231df',
        '76b2ea81-f538-46c6-8bb5-4bdfb332db34',
      ];

      const result = uut.transform(values);

      expect(result).toEqual(values);
    });

    it('should throw BadRequestException if any UUID is invalid', () => {
      const values = ['0b7f37c8-1f89-4db9-a519-a37c066a9a44', '123'];

      expect(() => uut.transform(values)).toThrow(
        new BadRequestException(`Invalid UUID: 123`),
      );
    });
  });
});

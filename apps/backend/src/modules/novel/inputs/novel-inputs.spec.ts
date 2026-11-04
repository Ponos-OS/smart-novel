import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateNovelInput } from './create-novel.input';
import { UpdateNovelInput } from './update-novel.input';

describe('Novel inputs', () => {
  describe(CreateNovelInput.name, () => {
    it('should trim the text fields and trim the tags', async () => {
      const input = plainToInstance(CreateNovelInput, {
        name: '  The Journey Begins ',
        description: ' A young hero leaves home. ',
        tags: [' Fantasy '],
      });

      const errors = await validate(input);

      expect(errors).toBeEmpty();
      expect(input).toEqual(
        expect.objectContaining({
          name: 'The Journey Begins',
          description: 'A young hero leaves home.',
          tags: ['Fantasy'],
        }),
      );
    });

    it.each([
      { field: 'name', value: '   ' },
      { field: 'state', value: 'ABANDONED' },
      { field: 'tags', value: ['fantasy', '  '] },
    ])(
      'should reject an invalid $field',
      async ({ field, value }) => {
        const input = plainToInstance(CreateNovelInput, {
          name: 'The Journey Begins',
          description: 'A young hero leaves home.',
          [field]: value,
        });

        const errors = await validate(input);

        expect(errors.map(({ property }) => property)).toEqual([
          field,
        ]);
      },
    );
  });

  describe(UpdateNovelInput.name, () => {
    it('should accept an empty input', async () => {
      const input = plainToInstance(UpdateNovelInput, {});

      const errors = await validate(input);

      expect(errors).toBeEmpty();
    });

    it.each([
      { field: 'name', value: '   ' },
      { field: 'state', value: 'ABANDONED' },
    ])(
      'should reject an invalid $field',
      async ({ field, value }) => {
        const input = plainToInstance(UpdateNovelInput, {
          [field]: value,
        });

        const errors = await validate(input);

        expect(errors.map(({ property }) => property)).toEqual([
          field,
        ]);
      },
    );
  });
});

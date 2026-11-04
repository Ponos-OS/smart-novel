import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { RequestTagInput } from './request-tag.input';
import { UpdateTagInput } from './update-tag.input';

describe('Tag inputs', () => {
  describe(RequestTagInput.name, () => {
    it('should trim the description and normalize the name', async () => {
      const input = plainToInstance(RequestTagInput, {
        name: '  Slice Of LIFE ',
        description: '  Quiet, everyday stories.  ',
      });

      const errors = await validate(input);

      expect(errors).toBeEmpty();
      expect(input).toMatchObject({
        name: 'slice of life',
        description: 'Quiet, everyday stories.',
      });
    });

    it('should accept the longest name and description', async () => {
      const input = plainToInstance(RequestTagInput, {
        name: 'a'.repeat(50),
        description: 'a'.repeat(650),
      });

      const errors = await validate(input);

      expect(errors).toBeEmpty();
    });

    it.each([
      {
        scenario: 'an empty name',
        input: { name: '   ', description: 'Magic.' },
        message: 'A tag name cannot be empty',
      },
      {
        scenario: 'a name longer than 50 characters',
        input: { name: 'a'.repeat(51), description: 'Magic.' },
        message: 'A tag name can have at most 50 characters',
      },
      {
        scenario: 'an empty description',
        input: { name: 'epic', description: '   ' },
        message: 'A tag needs a description',
      },
      {
        scenario: 'a description longer than 650 characters',
        input: { name: 'epic', description: 'a'.repeat(651) },
        message: 'A tag description can have at most 650 characters',
      },
    ])('should reject $scenario', async ({ input, message }) => {
      const errors = await validate(
        plainToInstance(RequestTagInput, input),
      );

      expect(
        errors.flatMap((error) => Object.values(error.constraints!)),
      ).toContain(message);
    });
  });

  describe(UpdateTagInput.name, () => {
    it.each([
      { scenario: 'a name', input: { name: ' Epic ' } },
      {
        scenario: 'a description',
        input: { description: ' Grand. ' },
      },
      { scenario: 'nothing', input: {} },
    ])('should accept $scenario alone', async ({ input }) => {
      const errors = await validate(
        plainToInstance(UpdateTagInput, input),
      );

      expect(errors).toBeEmpty();
    });

    it('should sanitize what is given and leave the rest undefined', () => {
      const input = plainToInstance(UpdateTagInput, {
        description: '  Grand stories.  ',
      });

      expect(input.name).toBeUndefined();
      expect(input.description).toBe('Grand stories.');
    });

    it.each([
      { field: 'name', value: 'a'.repeat(51) },
      { field: 'description', value: 'a'.repeat(651) },
      { field: 'description', value: '   ' },
    ])(
      'should reject $field "$value" when given',
      async ({ field, value }) => {
        const errors = await validate(
          plainToInstance(UpdateTagInput, { [field]: value }),
        );

        expect(errors).toHaveLength(1);
      },
    );
  });
});

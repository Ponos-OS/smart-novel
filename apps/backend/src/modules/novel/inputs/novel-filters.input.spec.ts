import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { NovelFiltersInput } from './novel-filters.input';
import { NovelOrderByInput } from './novel-order-by.input';

describe(NovelFiltersInput.name, () => {
  it('should accept every filter', async () => {
    const input = plainToInstance(NovelFiltersInput, {
      category: { in: ['Fantasy'], nin: ['Mystery'] },
      chapterCount: { min: 1, max: 20 },
      firstChapterCreatedAt: {
        from: new Date('2026-01-01T00:00:00.000Z'),
        to: new Date('2026-06-30T00:00:00.000Z'),
      },
      state: 'ONGOING',
      ownerIds: ['364554362883670018'],
    });

    const errors = await validate(input);

    expect(errors).toBeEmpty();
    expect(input.category?.in).toStrictEqual(['fantasy']);
  });

  it('should accept no filter at all', async () => {
    const input = plainToInstance(NovelFiltersInput, {});

    const errors = await validate(input);

    expect(errors).toBeEmpty();
  });

  it.each([
    {
      scenario: 'a maximum below the minimum',
      input: { chapterCount: { min: 10, max: 2 } },
    },
    {
      scenario: 'a negative minimum',
      input: { chapterCount: { min: -1 } },
    },
    {
      scenario: 'an end date before the start date',
      input: {
        firstChapterCreatedAt: {
          from: new Date('2026-06-30T00:00:00.000Z'),
          to: new Date('2026-01-01T00:00:00.000Z'),
        },
      },
    },
    { scenario: 'an unknown state', input: { state: 'ABANDONED' } },
    {
      scenario: 'an owner that is not a user ID',
      input: { ownerIds: ['mina'] },
    },
    {
      scenario: 'an owner ID with SQL in it',
      input: { ownerIds: ["1'; DROP TABLE novels;--"] },
    },
    {
      scenario: 'a category name with a NUL character',
      input: { category: { in: ['fan\u0000tasy'] } },
    },
    {
      scenario: 'an excluded category name with a NUL character',
      input: { category: { nin: ['\u0000'] } },
    },
    {
      scenario: 'more than 100 owners',
      input: {
        ownerIds: Array.from(
          { length: 101 },
          (_, i) => `${1000 + i}`,
        ),
      },
    },
  ])('should refuse $scenario', async ({ input }) => {
    const filters = plainToInstance(NovelFiltersInput, input);

    const errors = await validate(filters);

    expect(errors).not.toBeEmpty();
  });
});

describe(NovelOrderByInput.name, () => {
  it('should accept an empty input, which is what Nest validates when the argument is left out', async () => {
    const input = plainToInstance(NovelOrderByInput, {});

    const errors = await validate(input);

    expect(errors).toBeEmpty();
  });

  it.each([{ field: 'AUTHOR' }, { direction: 'SIDEWAYS' }])(
    'should refuse %j',
    async (value) => {
      const input = plainToInstance(NovelOrderByInput, value);

      const errors = await validate(input);

      expect(errors).toHaveLength(1);
    },
  );
});

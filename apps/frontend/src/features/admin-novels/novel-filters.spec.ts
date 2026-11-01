import { NovelState } from '../../generated/graphql';
import {
  buildNovelFilters,
  EMPTY_NOVEL_FILTERS,
  hasAnyFilter,
  type NovelFilterForm,
} from './novel-filters';

const mina = {
  userId: '364554362883670018',
  penName: 'Mina_Ardalan',
  name: 'Mina Ardalan',
  email: 'mina.ardalan@example.com',
};
const omid = { userId: '364554362732740610', penName: 'Omid_Rahimi' };

const form = (
  changes: Partial<NovelFilterForm>,
): NovelFilterForm => ({
  ...EMPTY_NOVEL_FILTERS,
  ...changes,
});

describe(buildNovelFilters.name, () => {
  it('should ask for nothing from an empty form', () => {
    const result = buildNovelFilters(EMPTY_NOVEL_FILTERS);

    expect(result).toStrictEqual({
      filters: undefined,
      problems: {},
    });
  });

  it('should turn every field into its filter, the days into the whole day in UTC and the writers into their user IDs', () => {
    const result = buildNovelFilters(
      form({
        minChapters: '2',
        maxChapters: '40',
        firstChapterFrom: '2026-01-01',
        firstChapterTo: '2026-06-30',
        state: NovelState.Finished,
        writers: [mina, omid],
      }),
    );

    expect(result).toStrictEqual({
      filters: {
        chapterCount: { min: 2, max: 40 },
        firstChapterCreatedAt: {
          from: '2026-01-01T00:00:00.000Z',
          to: '2026-06-30T23:59:59.999Z',
        },
        state: NovelState.Finished,
        ownerIds: [mina.userId, omid.userId],
      },
      problems: {},
    });
  });

  it.each([
    {
      scenario: 'only a minimum',
      changes: { minChapters: '3' },
      chapterCount: { min: 3, max: undefined },
    },
    {
      scenario: 'only a maximum of zero',
      changes: { maxChapters: '0' },
      chapterCount: { min: undefined, max: 0 },
    },
  ])('should send $scenario', ({ changes, chapterCount }) => {
    const { filters } = buildNovelFilters(form(changes));

    expect(filters).toStrictEqual({ chapterCount });
  });

  it('should send a start day alone, and an end day alone', () => {
    expect(
      buildNovelFilters(form({ firstChapterFrom: '2026-01-01' }))
        .filters,
    ).toStrictEqual({
      firstChapterCreatedAt: {
        from: '2026-01-01T00:00:00.000Z',
        to: undefined,
      },
    });
    expect(
      buildNovelFilters(form({ firstChapterTo: '2026-06-30' }))
        .filters,
    ).toStrictEqual({
      firstChapterCreatedAt: {
        from: undefined,
        to: '2026-06-30T23:59:59.999Z',
      },
    });
  });

  it.each([
    {
      scenario: 'a maximum below the minimum',
      changes: { minChapters: '10', maxChapters: '2' },
      problems: { chapters: 'The maximum is below the minimum' },
    },
    {
      scenario: 'a negative number',
      changes: { minChapters: '-1' },
      problems: { chapters: 'Use whole numbers, 0 or more' },
    },
    {
      scenario: 'a fraction',
      changes: { maxChapters: '1.5' },
      problems: { chapters: 'Use whole numbers, 0 or more' },
    },
    {
      scenario: 'an end day before the start day',
      changes: {
        firstChapterFrom: '2026-06-30',
        firstChapterTo: '2026-01-01',
      },
      problems: { dates: 'The end is before the start' },
    },
  ])(
    'should leave out $scenario, which the server would refuse, and say what is wrong',
    ({ changes, problems }) => {
      const result = buildNovelFilters(form(changes));

      expect(result.problems).toStrictEqual(problems);
      expect(result.filters).toBeUndefined();
    },
  );

  it('should keep the filters that are fine next to one that is not', () => {
    const result = buildNovelFilters(
      form({
        minChapters: '10',
        maxChapters: '2',
        state: NovelState.Ongoing,
      }),
    );

    expect(result.filters).toStrictEqual({
      state: NovelState.Ongoing,
    });
  });
});

describe(hasAnyFilter.name, () => {
  it('should tell an empty form from one with something in it', () => {
    expect(hasAnyFilter(EMPTY_NOVEL_FILTERS)).toBeFalse();
    expect(hasAnyFilter(form({ writers: [mina] }))).toBeTrue();
    expect(hasAnyFilter(form({ minChapters: '1' }))).toBeTrue();
  });
});

import {
  type NovelFiltersInput,
  NovelState,
} from '../../generated/graphql';

export interface PickedWriter {
  userId: string;
  penName: string;
  name?: string | null;
  email?: string | null;
}

export interface NovelFilterForm {
  minChapters: string;
  maxChapters: string;
  /** @description A day, `YYYY-MM-DD`, as a date input gives it. */
  firstChapterFrom: string;
  firstChapterTo: string;
  state: '' | NovelState;
  writers: PickedWriter[];
}

export const EMPTY_NOVEL_FILTERS: NovelFilterForm = {
  minChapters: '',
  maxChapters: '',
  firstChapterFrom: '',
  firstChapterTo: '',
  state: '',
  writers: [],
};

export interface NovelFilterProblems {
  chapters?: string;
  dates?: string;
}

function parseCount(text: string): number | undefined | null {
  if (text.trim() === '') {
    return undefined;
  }

  const count = Number(text);

  return Number.isInteger(count) && count >= 0 ? count : null;
}

/**
 * @description
 * What the form asks for, as the filters of the query, plus what is wrong with it. A range the server would refuse (a maximum below the minimum, an end before the start) is left out of the query and reported, so the list keeps showing the last good result instead of an error.
 */
export function buildNovelFilters(form: NovelFilterForm): {
  filters: NovelFiltersInput | undefined;
  problems: NovelFilterProblems;
} {
  const filters: NovelFiltersInput = {};
  const problems: NovelFilterProblems = {};
  const min = parseCount(form.minChapters);
  const max = parseCount(form.maxChapters);

  if (min === null || max === null) {
    problems.chapters = 'Use whole numbers, 0 or more';
  } else if (min !== undefined && max !== undefined && max < min) {
    problems.chapters = 'The maximum is below the minimum';
  } else if (min !== undefined || max !== undefined) {
    filters.chapterCount = { min, max };
  }

  const { firstChapterFrom: from, firstChapterTo: to } = form;

  if (from && to && to < from) {
    problems.dates = 'The end is before the start';
  } else if (from || to) {
    filters.firstChapterCreatedAt = {
      from: from ? `${from}T00:00:00.000Z` : undefined,
      to: to ? `${to}T23:59:59.999Z` : undefined,
    };
  }

  if (form.state) {
    filters.state = form.state;
  }

  if (form.writers.length > 0) {
    filters.ownerIds = form.writers.map(({ userId }) => userId);
  }

  return {
    filters: Object.keys(filters).length > 0 ? filters : undefined,
    problems,
  };
}

export function hasAnyFilter(form: NovelFilterForm): boolean {
  return JSON.stringify(form) !== JSON.stringify(EMPTY_NOVEL_FILTERS);
}

import type {
  ChapterCountRangeInput,
  NovelState,
  NovelWhereInput,
} from '../generated/graphql';

/**
 * @description What the novel lists can be filtered by, as the pages think of it. `novelQuery` turns it into the arguments of `novels`.
 */
export interface NovelFilters {
  /** @description `in`: the novel has one of these tags; `nin`: it has none of them. */
  tags?: { in?: string[]; nin?: string[] };
  chapterCount?: ChapterCountRangeInput;
  /** @description Inclusive; novels without a chapter are left out once a bound is given. */
  firstChapterCreatedAt?: { from?: string; to?: string };
  state?: NovelState;
  /** @description The `userID` of the writers whose novels to list. */
  ownerIds?: string[];
}

export interface NovelQuery {
  where?: NovelWhereInput;
  chapterCount?: ChapterCountRangeInput;
  ownerIDs?: string[];
}

export function novelQuery(
  filters: NovelFilters | undefined,
): NovelQuery {
  if (!filters) {
    return {};
  }

  const where: NovelWhereInput = {};
  const { tags, firstChapterCreatedAt, state } = filters;

  if (tags?.in?.length) {
    where.hasTagsWith = [{ nameIn: tags.in }];
  }
  if (tags?.nin?.length) {
    where.not = { hasTagsWith: [{ nameIn: tags.nin }] };
  }
  if (firstChapterCreatedAt?.from) {
    where.firstChapterCreatedAtGTE = firstChapterCreatedAt.from;
  }
  if (firstChapterCreatedAt?.to) {
    where.firstChapterCreatedAtLTE = firstChapterCreatedAt.to;
  }
  if (state) {
    where.state = state;
  }

  return {
    where: Object.keys(where).length > 0 ? where : undefined,
    chapterCount: filters.chapterCount,
    ownerIDs: filters.ownerIds?.length ? filters.ownerIds : undefined,
  };
}

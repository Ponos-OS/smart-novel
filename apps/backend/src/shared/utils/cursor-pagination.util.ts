import { PageInfo } from 'nestjs-backend-common';

import { PaginationArgs } from '../interfaces';

export interface CursorPaginationParams {
  /** @description cursor: `{ id: decodedId }` */
  cursor?: { id: string };
  /** @description Skip the cursor record itself */
  skip?: number;
  /** @description How many records to fetch (requested + 1 for hasMore detection) */
  take?: number;
  /** @description Whether we reversed the query direction (for `before`/`last`) and need to reverse results back */
  shouldReverse: boolean;
}

export interface TrimmedResult<T> {
  items: T[];
  hasMore: boolean;
}

export interface CursorConnection<TNode> {
  edges: { cursor: string; node: TNode }[];
  pageInfo: PageInfo;
}

export function encodeCursor(id: string): string {
  return Buffer.from(id).toString('base64');
}

export function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64').toString('utf-8');
}

function isBackward({ first, last }: PaginationArgs = {}): boolean {
  return !!last && !first;
}

/**
 * @summary Translates Relay-style pagination args into Prisma cursor pagination params.
 *
 * @description
 * This function handles:
 * - Base64 cursor decoding (`after`/`before` → UUID)
 * - Computing `take = requested + 1` (for hasMore detection)
 * - Setting `cursor` and `skip: 1` to skip the cursor record
 * - Returning a `shouldReverse` flag for `before`-based queries
 *
 * **NOTE**: the caller is responsible for:
 * - Flipping `orderBy` direction when `shouldReverse` is `true`
 * - Calling {@link trimCursorPaginationResults} to trim the extra record
 */
export function buildCursorPaginationParams(
  pagination?: PaginationArgs,
): CursorPaginationParams {
  const { first, last, after, before } = pagination ?? {};
  const afterId = after && decodeCursor(after);
  const beforeId = before && decodeCursor(before);
  const result: CursorPaginationParams = {
    shouldReverse: false,
  };

  if (afterId) {
    result.cursor = { id: afterId };
    result.skip = 1;
  }

  // For simplicity sake I am skipping the implementation of when client sends both after & before.
  // If we have both after and before, we need a different strategy
  if (beforeId && !afterId) {
    result.cursor = { id: beforeId };
    result.skip = 1;
    result.shouldReverse = true;
  }

  // `last` alone means "the final N rows": read from the end, then flip back
  if (!afterId && !beforeId && isBackward(pagination)) {
    result.shouldReverse = true;
  }

  // Take extra to determine hasNextPage/hasPreviousPage
  const take = first ?? last;
  if (take) {
    result.take = take + 1;
  }

  return result;
}

/**
 * @description Trims the extra record fetched for hasMore detection and reverses results when needed (for `before`/`last` queries).
 *
 * @param items The raw results from the database (may contain 1 extra record)
 * @param shouldReverse Whether the query direction was reversed (from {@link buildCursorPaginationParams})
 */
export function trimCursorPaginationResults<T>(
  items: T[],
  pagination?: PaginationArgs,
  shouldReverse = false,
): TrimmedResult<T> {
  const { first, last } = pagination ?? {};
  const take = first ?? last;
  // Make a mutable copy so callers don't need to worry about mutations
  const result = [...items];

  // If we reversed for 'before', reverse back
  if (shouldReverse) {
    result.reverse();
  }

  let hasMore = false;

  // Trim the extra record we fetched
  if (take && result.length > take) {
    hasMore = true;

    if (last && !first) {
      result.shift();
    } else {
      result.pop();
    }
  }

  return { items: result, hasMore };
}

/**
 * @description Computes Relay `pageInfo` for both directions.
 *
 * @param hasMore Whether {@link trimCursorPaginationResults} trimmed an extra record
 */
export function buildPageInfo(
  edges: { cursor: string }[],
  hasMore: boolean,
  pagination: PaginationArgs = {},
): PageInfo {
  const backward = isBackward(pagination);

  return {
    startCursor: edges.length > 0 ? edges[0].cursor : null,
    endCursor:
      edges.length > 0 ? edges[edges.length - 1].cursor : null,
    hasPreviousPage: backward ? hasMore : !!pagination.after,
    hasNextPage: backward ? !!pagination.before : hasMore,
  };
}

/**
 * @description Runs the whole Relay flow: cursor params, query, trim, edges, `pageInfo`.
 *
 * @param findMany Must flip its `orderBy` when `shouldReverse` is `true`, and pass `cursor`, `skip` and `take` to the query.
 */
export async function paginateConnection<
  TRow extends { id: string },
  TNode,
>({
  pagination,
  findMany,
  toNode,
}: {
  pagination: PaginationArgs;
  findMany: (params: CursorPaginationParams) => Promise<TRow[]>;
  toNode: (row: TRow) => TNode;
}): Promise<CursorConnection<TNode>> {
  const params = buildCursorPaginationParams(pagination);
  const rows = await findMany(params);
  const { items, hasMore } = trimCursorPaginationResults(
    rows,
    pagination,
    params.shouldReverse,
  );
  const edges = items.map((row) => ({
    cursor: encodeCursor(row.id),
    node: toNode(row),
  }));

  return {
    edges,
    pageInfo: buildPageInfo(edges, hasMore, pagination),
  };
}

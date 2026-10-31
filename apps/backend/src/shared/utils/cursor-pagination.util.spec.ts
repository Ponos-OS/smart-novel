import {
  buildCursorPaginationParams,
  buildPageInfo,
  encodeCursor,
  paginateConnection,
  trimCursorPaginationResults,
} from './cursor-pagination.util';

describe(buildCursorPaginationParams.name, () => {
  it.each([undefined, {}])(
    'should return defaults values (%s)',
    (pagination) => {
      const result = buildCursorPaginationParams(pagination);

      expect(result).toStrictEqual({ shouldReverse: false });
    },
  );

  it('should decode after cursor and set skip', () => {
    const id = 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c';
    const afterCursor = Buffer.from(id).toString('base64');

    const result = buildCursorPaginationParams({
      after: afterCursor,
      first: 10,
    });

    expect(result).toStrictEqual({
      cursor: { id },
      skip: 1,
      take: 11,
      shouldReverse: false,
    });
  });

  it('should decode before cursor, set skip, and flag shouldReverse', () => {
    const id = '904bf826-33be-4172-b63f-665bba9007b9';
    const beforeCursor = Buffer.from(id).toString('base64');

    const result = buildCursorPaginationParams({
      before: beforeCursor,
      last: 5,
    });

    expect(result).toStrictEqual({
      cursor: { id },
      skip: 1,
      take: 6,
      shouldReverse: true,
    });
  });

  it('should prefer after over before when both are provided', () => {
    const afterId = 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c';
    const beforeId = '904bf826-33be-4172-b63f-665bba9007b9';

    const result = buildCursorPaginationParams({
      after: Buffer.from(afterId).toString('base64'),
      before: Buffer.from(beforeId).toString('base64'),
      first: 10,
    });

    expect(result.cursor).toStrictEqual({ id: afterId });
    expect(result.shouldReverse).toBe(false);
  });

  it('should set take to first + 1 when only first is provided', () => {
    const result = buildCursorPaginationParams({ first: 20 });

    expect(result.take).toBe(21);
    expect(result.shouldReverse).toBe(false);
  });

  it('should set take to last + 1 and reverse when only last is provided', () => {
    const result = buildCursorPaginationParams({ last: 15 });

    expect(result.take).toBe(16);
    expect(result.shouldReverse).toBe(true);
  });

  it('should not set take when neither first nor last is provided', () => {
    const id = 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c';

    const result = buildCursorPaginationParams({
      after: Buffer.from(id).toString('base64'),
    });

    expect(result.take).toBeUndefined();
  });
});

describe(trimCursorPaginationResults.name, () => {
  it('should return all items when count does not exceed take', () => {
    const items = ['a', 'b', 'c'];

    const result = trimCursorPaginationResults(items, { first: 5 });

    expect(result).toStrictEqual({
      items: ['a', 'b', 'c'],
      hasMore: false,
    });
  });

  it('should pop the last item when first is used and items exceed take', () => {
    const items = ['a', 'b', 'c', 'd'];

    const result = trimCursorPaginationResults(items, { first: 3 });

    expect(result).toStrictEqual({
      items: ['a', 'b', 'c'],
      hasMore: true,
    });
  });

  it('should shift the first item when last is used and items exceed take', () => {
    const items = ['a', 'b', 'c', 'd'];

    const result = trimCursorPaginationResults(items, { last: 3 });

    expect(result).toStrictEqual({
      items: ['b', 'c', 'd'],
      hasMore: true,
    });
  });

  it('should reverse items when shouldReverse is true', () => {
    const items = ['c', 'b', 'a'];

    const result = trimCursorPaginationResults(
      items,
      { last: 5 },
      true,
    );

    expect(result).toStrictEqual({
      items: ['a', 'b', 'c'],
      hasMore: false,
    });
  });

  it('should reverse before trimming when shouldReverse is true and items exceed take', () => {
    const items = ['d', 'c', 'b', 'a'];

    const result = trimCursorPaginationResults(
      items,
      { last: 3 },
      true,
    );

    expect(result).toStrictEqual({
      items: ['b', 'c', 'd'],
      hasMore: true,
    });
  });

  it('should return all items when no pagination is provided', () => {
    const items = ['a', 'b'];

    const result = trimCursorPaginationResults(items);

    expect(result).toStrictEqual({
      items: ['a', 'b'],
      hasMore: false,
    });
  });

  it('should not mutate the original array', () => {
    const items = ['a', 'b', 'c', 'd'];

    trimCursorPaginationResults(items, { first: 3 });

    expect(items).toStrictEqual(['a', 'b', 'c', 'd']);
  });

  it('should handle empty items', () => {
    const result = trimCursorPaginationResults([], { first: 10 });

    expect(result).toStrictEqual({ items: [], hasMore: false });
  });
});

describe(buildPageInfo.name, () => {
  const edges = [
    { cursor: encodeCursor('bb563ad5-1ac4-46c2-a25f-6f62d245f44c') },
    { cursor: encodeCursor('904bf826-33be-4172-b63f-665bba9007b9') },
  ];

  it.each([
    {
      name: 'first page with more rows',
      pagination: { first: 2 },
      hasMore: true,
      expected: { hasPreviousPage: false, hasNextPage: true },
    },
    {
      name: 'forward page after a cursor, last page',
      pagination: { first: 2, after: edges[0].cursor },
      hasMore: false,
      expected: { hasPreviousPage: true, hasNextPage: false },
    },
    {
      name: 'last page of the list with more rows before it',
      pagination: { last: 2 },
      hasMore: true,
      expected: { hasPreviousPage: true, hasNextPage: false },
    },
    {
      name: 'backward page before a cursor, nothing earlier',
      pagination: { last: 2, before: edges[1].cursor },
      hasMore: false,
      expected: { hasPreviousPage: false, hasNextPage: true },
    },
    {
      name: 'backward page before a cursor with more rows earlier',
      pagination: { last: 2, before: edges[1].cursor },
      hasMore: true,
      expected: { hasPreviousPage: true, hasNextPage: true },
    },
  ])('should handle $name', ({ pagination, hasMore, expected }) => {
    const result = buildPageInfo(edges, hasMore, pagination);

    expect(result).toStrictEqual({
      startCursor: edges[0].cursor,
      endCursor: edges[1].cursor,
      ...expected,
    });
  });

  it('should return null cursors when there are no edges', () => {
    const result = buildPageInfo([], false, { first: 10 });

    expect(result).toStrictEqual({
      startCursor: null,
      endCursor: null,
      hasPreviousPage: false,
      hasNextPage: false,
    });
  });
});

describe(paginateConnection.name, () => {
  const rows = [
    { id: 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c', name: 'Fantasy' },
    { id: '904bf826-33be-4172-b63f-665bba9007b9', name: 'Horror' },
    { id: '3c0c1b5e-6d1e-4f43-9a55-0f2c8a1d7e21', name: 'Romance' },
  ];

  it('should build edges and trim the extra row for forward paging', async () => {
    const findMany = vi
      .fn<() => Promise<typeof rows>>()
      .mockResolvedValue(rows);

    const result = await paginateConnection({
      pagination: { first: 2 },
      findMany,
      toNode: (row) => row.name,
    });

    expect(findMany).toHaveBeenCalledWith({
      take: 3,
      shouldReverse: false,
    });
    expect(result.edges).toStrictEqual([
      { cursor: encodeCursor(rows[0].id), node: 'Fantasy' },
      { cursor: encodeCursor(rows[1].id), node: 'Horror' },
    ]);
    expect(result.pageInfo).toStrictEqual({
      startCursor: encodeCursor(rows[0].id),
      endCursor: encodeCursor(rows[1].id),
      hasPreviousPage: false,
      hasNextPage: true,
    });
  });

  it('should restore order and report earlier rows for backward paging', async () => {
    const reversedRows = [...rows].reverse();
    const findMany = vi
      .fn<() => Promise<typeof rows>>()
      .mockResolvedValue(reversedRows);

    const result = await paginateConnection({
      pagination: { last: 2 },
      findMany,
      toNode: (row) => row.name,
    });

    expect(findMany).toHaveBeenCalledWith({
      take: 3,
      shouldReverse: true,
    });
    expect(result.edges.map(({ node }) => node)).toStrictEqual([
      'Horror',
      'Romance',
    ]);
    expect(result.pageInfo).toMatchObject({
      hasPreviousPage: true,
      hasNextPage: false,
    });
  });
});

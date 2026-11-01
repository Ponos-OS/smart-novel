import { BadRequestException } from '@nestjs/common';

import {
  boundPagination,
  buildCursorPaginationParams,
  buildPageInfo,
  type CursorCodecPort,
  paginateConnection,
  trimCursorPaginationResults,
} from './cursor-pagination.util';

const codec: CursorCodecPort = {
  encode: (audience, id) => `${audience}:${id}`,
  decode: (cursor, audience) => {
    if (!cursor.startsWith(`${audience}:`)) {
      throw new BadRequestException('Invalid cursor');
    }

    return cursor.slice(audience.length + 1);
  },
};
const decodeCursor = (cursor: string) =>
  codec.decode(cursor, 'novels');

describe(buildCursorPaginationParams.name, () => {
  it.each([undefined, {}])(
    'should return defaults values (%s)',
    (pagination) => {
      const result = buildCursorPaginationParams(
        pagination,
        decodeCursor,
      );

      expect(result).toStrictEqual({ shouldReverse: false });
    },
  );

  it('should decode after cursor and set skip', () => {
    const id = 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c';
    const afterCursor = codec.encode('novels', id);

    const result = buildCursorPaginationParams(
      { after: afterCursor, first: 10 },
      decodeCursor,
    );

    expect(result).toStrictEqual({
      cursor: { id },
      skip: 1,
      take: 11,
      shouldReverse: false,
    });
  });

  it('should decode before cursor, set skip, and flag shouldReverse', () => {
    const id = '904bf826-33be-4172-b63f-665bba9007b9';
    const beforeCursor = codec.encode('novels', id);

    const result = buildCursorPaginationParams(
      { before: beforeCursor, last: 5 },
      decodeCursor,
    );

    expect(result).toStrictEqual({
      cursor: { id },
      skip: 1,
      take: 6,
      shouldReverse: true,
    });
  });

  it('should refuse after and before together', () => {
    const after = codec.encode(
      'novels',
      'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
    );
    const before = codec.encode(
      'novels',
      '904bf826-33be-4172-b63f-665bba9007b9',
    );

    expect(() =>
      buildCursorPaginationParams(
        { after, before, first: 10 },
        decodeCursor,
      ),
    ).toThrow('after and before cannot be used together');
  });

  it('should let the decoder refuse a cursor', () => {
    const after = codec.encode(
      'chapters',
      'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
    );

    expect(() =>
      buildCursorPaginationParams({ after }, decodeCursor),
    ).toThrow('Invalid cursor');
  });

  it('should set take to first + 1 when only first is provided', () => {
    const result = buildCursorPaginationParams(
      { first: 20 },
      decodeCursor,
    );

    expect(result.take).toBe(21);
    expect(result.shouldReverse).toBe(false);
  });

  it('should set take to last + 1 and reverse when only last is provided', () => {
    const result = buildCursorPaginationParams(
      { last: 15 },
      decodeCursor,
    );

    expect(result.take).toBe(16);
    expect(result.shouldReverse).toBe(true);
  });

  it('should not set take when neither first nor last is provided', () => {
    const id = 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c';

    const result = buildCursorPaginationParams(
      { after: codec.encode('novels', id) },
      decodeCursor,
    );

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
    {
      cursor: codec.encode(
        'novels',
        'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
      ),
    },
    {
      cursor: codec.encode(
        'novels',
        '904bf826-33be-4172-b63f-665bba9007b9',
      ),
    },
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
      codec,
      audience: 'novels',
      pagination: { first: 2 },
      findMany,
      toNode: (row) => row.name,
    });

    expect(findMany).toHaveBeenCalledWith({
      take: 3,
      shouldReverse: false,
    });
    expect(result.edges).toStrictEqual([
      { cursor: codec.encode('novels', rows[0].id), node: 'Fantasy' },
      { cursor: codec.encode('novels', rows[1].id), node: 'Horror' },
    ]);
    expect(result.pageInfo).toStrictEqual({
      startCursor: codec.encode('novels', rows[0].id),
      endCursor: codec.encode('novels', rows[1].id),
      hasPreviousPage: false,
      hasNextPage: true,
    });
  });

  it('should refuse a cursor issued for another audience before querying', async () => {
    const findMany = vi.fn<() => Promise<typeof rows>>();

    const promise = paginateConnection({
      codec,
      audience: 'novels',
      pagination: {
        first: 2,
        after: codec.encode('chapters', rows[0].id),
      },
      findMany,
      toNode: (row) => row.name,
    });

    await expect(promise).rejects.toThrow('Invalid cursor');
    expect(findMany).not.toHaveBeenCalled();
  });

  it('should restore order and report earlier rows for backward paging', async () => {
    const reversedRows = [...rows].reverse();
    const findMany = vi
      .fn<() => Promise<typeof rows>>()
      .mockResolvedValue(reversedRows);

    const result = await paginateConnection({
      codec,
      audience: 'novels',
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

describe(boundPagination.name, () => {
  const sizes = { defaultSize: 20, maxSize: 100 };
  const cursor = codec.encode(
    'novels',
    'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
  );

  it('should default the page size when neither first nor last is given', () => {
    const result = boundPagination({ after: cursor }, sizes);

    expect(result).toStrictEqual({ after: cursor, first: 20 });
  });

  it.each([{ first: 100 }, { last: 1 }])(
    'should keep %j as it is',
    (pagination) => {
      const result = boundPagination(pagination, sizes);

      expect(result).toBe(pagination);
    },
  );

  it.each([
    [{ first: 0 }, 'at least 1'],
    [{ last: -2 }, 'at least 1'],
    [{ first: 101 }, 'at most 100'],
    [{ last: 101 }, 'at most 100'],
  ])('should refuse %j', (pagination, message) => {
    expect(() => boundPagination(pagination, sizes)).toThrow(message);
  });
});

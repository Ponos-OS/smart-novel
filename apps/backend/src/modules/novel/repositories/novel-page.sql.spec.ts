import { NovelState, Prisma } from '@prisma/client';

import { OrderDirection } from '../../../shared';
import { PrismaTransactionClient } from '../../prisma';
import { NovelOrderField } from '../enums';
import {
  buildAfterCursorCondition,
  buildFilterConditions,
  buildOrderBy,
  effectiveDirection,
} from './novel-page.sql';

const cursorId = '5b2c0f3e-0a53-4d3c-9d2c-9a3d1f7f4a10';
const toSql = (conditions: Prisma.Sql[]) =>
  conditions.map(({ text, values }) => ({
    sql: text.replace(/\s+/g, ' ').trim(),
    values,
  }));

describe(buildFilterConditions.name, () => {
  it('should ask for nothing without filters', () => {
    expect(buildFilterConditions()).toStrictEqual([]);
    expect(buildFilterConditions({})).toStrictEqual([]);
  });

  it('should match the categories by name, case-insensitively, and leave out the excluded ones', () => {
    const result = toSql(
      buildFilterConditions({
        categoryIn: ['Fantasy', 'sci-fi'],
        categoryNin: ['Mystery'],
      }),
    );

    expect(result[0].sql).toContain(
      'lower(c.name) = ANY($1::text[])',
    );
    expect(result[0].values).toStrictEqual([['fantasy', 'sci-fi']]);
    expect(result[1].sql).toStartWith('NOT EXISTS (');
    expect(result[1].values).toStrictEqual([['mystery']]);
  });

  it('should filter by state and by the owners through their writer rows', () => {
    const result = toSql(
      buildFilterConditions({
        state: NovelState.FINISHED,
        ownerIds: ['364554362883670018', '364554362732740610'],
      }),
    );

    expect(result).toStrictEqual([
      {
        sql: 'n.state = $1::"NovelState"',
        values: [NovelState.FINISHED],
      },
      {
        sql: 'n.writer_id IN (SELECT w.id FROM writers w WHERE w.user_id = ANY($1::text[]))',
        values: [['364554362883670018', '364554362732740610']],
      },
    ]);
  });

  it('should bound the date of the first chapter at both ends, inclusively', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-06-30T00:00:00.000Z');

    const result = toSql(
      buildFilterConditions({
        firstChapterCreatedFrom: from,
        firstChapterCreatedTo: to,
      }),
    );

    expect(result).toStrictEqual([
      { sql: 'n.first_chapter_created_at >= $1', values: [from] },
      { sql: 'n.first_chapter_created_at <= $1', values: [to] },
    ]);
  });

  it.each([
    {
      scenario: 'a lower bound selects from the grouped counts',
      filters: { chapterCountMin: 10 },
      sql: 'n.id IN ( SELECT novel_id FROM chapters GROUP BY novel_id HAVING COUNT(*) >= $1 )',
      values: [10],
    },
    {
      scenario: 'both bounds select from the grouped counts',
      filters: { chapterCountMin: 10, chapterCountMax: 50 },
      sql: 'n.id IN ( SELECT novel_id FROM chapters GROUP BY novel_id HAVING COUNT(*) >= $1 AND COUNT(*) <= $2)',
      values: [10, 50],
    },
    {
      scenario:
        'only an upper bound keeps novels without a chapter, which have no row in chapters',
      filters: { chapterCountMax: 5 },
      sql: 'n.id NOT IN ( SELECT novel_id FROM chapters GROUP BY novel_id HAVING COUNT(*) > $1)',
      values: [5],
    },
  ])(
    'should filter by chapter count: $scenario',
    ({ filters, sql, values }) => {
      const [result] = toSql(buildFilterConditions(filters));

      expect(result).toStrictEqual({ sql, values });
    },
  );

  it('should ask for nothing when the lower bound is zero and there is no upper bound', () => {
    const result = buildFilterConditions({ chapterCountMin: 0 });

    expect(result).toStrictEqual([]);
  });
});

describe(buildOrderBy.name, () => {
  it.each([
    {
      order: {
        field: NovelOrderField.NAME,
        direction: OrderDirection.ASC,
      },
      backward: false,
      sql: 'ORDER BY n.name ASC, n.id ASC',
    },
    {
      order: {
        field: NovelOrderField.NAME,
        direction: OrderDirection.ASC,
      },
      backward: true,
      sql: 'ORDER BY n.name DESC, n.id DESC',
    },
    {
      order: {
        field: NovelOrderField.FIRST_CHAPTER_CREATED_AT,
        direction: OrderDirection.DESC,
      },
      backward: false,
      sql: 'ORDER BY n.first_chapter_created_at DESC NULLS LAST, n.id DESC',
    },
    {
      order: {
        field: NovelOrderField.FIRST_CHAPTER_CREATED_AT,
        direction: OrderDirection.DESC,
      },
      backward: true,
      sql: 'ORDER BY n.first_chapter_created_at ASC NULLS FIRST, n.id ASC',
    },
  ])(
    'should order by $order.field $order.direction, backward $backward',
    ({ order, backward, sql }) => {
      const result = buildOrderBy(order, backward);

      expect(result.text.replace(/\s+/g, ' ')).toBe(sql);
    },
  );
});

describe(effectiveDirection.name, () => {
  it.each([
    [OrderDirection.ASC, false, OrderDirection.ASC],
    [OrderDirection.ASC, true, OrderDirection.DESC],
    [OrderDirection.DESC, false, OrderDirection.DESC],
    [OrderDirection.DESC, true, OrderDirection.ASC],
  ])(
    'should turn %s into %s... when backward is %s',
    (direction, backward, expected) => {
      expect(effectiveDirection(direction, backward)).toBe(expected);
    },
  );
});

describe(buildAfterCursorCondition.name, () => {
  const dated = {
    field: NovelOrderField.FIRST_CHAPTER_CREATED_AT,
    direction: OrderDirection.DESC,
  };
  let prisma: { $queryRaw: ReturnType<typeof vi.fn> };

  const build = async (
    order: Parameters<typeof buildAfterCursorCondition>[2],
    backward: boolean,
    cursorHasNoDate: boolean,
  ) => {
    prisma.$queryRaw.mockResolvedValue([{ isNull: cursorHasNoDate }]);
    const { text } = await buildAfterCursorCondition(
      prisma as unknown as PrismaTransactionClient,
      cursorId,
      order,
      backward,
    );

    return text.replace(/\s+/g, ' ');
  };

  beforeEach(() => {
    prisma = { $queryRaw: vi.fn() };
  });

  it('should continue after a row with a date, then reach the rows without one', async () => {
    const sql = await build(dated, false, false);

    expect(sql).toContain(
      '(n.first_chapter_created_at < (SELECT n.first_chapter_created_at FROM novels n WHERE n.id = $1::uuid) OR (n.first_chapter_created_at = (SELECT n.first_chapter_created_at FROM novels n WHERE n.id = $2::uuid) AND n.id < $3::uuid))',
    );
    expect(sql).toEndWith('OR n.first_chapter_created_at IS NULL)');
  });

  it('should continue among the rows without a date when the cursor row has none', async () => {
    const sql = await build(dated, false, true);

    expect(sql).toBe(
      '(n.first_chapter_created_at IS NULL AND n.id < $1::uuid)',
    );
  });

  it('should read backward from a row with a date without ever reaching the rows without one', async () => {
    const sql = await build(dated, true, false);

    expect(sql).toContain('n.first_chapter_created_at > (SELECT');
    expect(sql).not.toContain('IS NULL');
  });

  it('should read backward from a row without a date through every row that has one', async () => {
    const sql = await build(dated, true, true);

    expect(sql).toContain(
      'n.first_chapter_created_at IS NOT NULL OR',
    );
  });

  it('should compare names as plain values, with the id as the tie-break', async () => {
    const sql = await build(
      { field: NovelOrderField.NAME, direction: OrderDirection.ASC },
      false,
      false,
    );

    expect(sql).toBe(
      '(n.name > (SELECT n.name FROM novels n WHERE n.id = $1::uuid) OR (n.name = (SELECT n.name FROM novels n WHERE n.id = $2::uuid) AND n.id > $3::uuid))',
    );
  });

  it('should refuse a cursor whose row no longer exists', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    const result = buildAfterCursorCondition(
      prisma as unknown as PrismaTransactionClient,
      cursorId,
      dated,
      false,
    );

    await expect(result).rejects.toThrow('Invalid cursor');
  });
});

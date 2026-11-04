import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { INVALID_CURSOR_MESSAGE } from '@smart-novel/shared';

import { OrderDirection } from '../../../shared';
import { PrismaTransactionClient } from '../../prisma';
import { NovelOrderField } from '../enums';
import {
  NovelConnectionFilters,
  NovelPageOrder,
} from '../interfaces';

interface SortColumn {
  sql: Prisma.Sql;
  nullable: boolean;
}

const SORT_COLUMNS: Record<NovelOrderField, SortColumn> = {
  [NovelOrderField.NAME]: {
    sql: Prisma.raw('n.name'),
    nullable: false,
  },
  [NovelOrderField.FIRST_CHAPTER_CREATED_AT]: {
    sql: Prisma.raw('n.first_chapter_created_at'),
    nullable: true,
  },
};

const tagNameIn = (names: string[]) =>
  Prisma.sql`EXISTS (
    SELECT 1 FROM novel_tags nc
    JOIN tags c ON c.id = nc.tag_id
    WHERE nc.novel_id = n.id AND lower(c.name) = ANY(${names.map((name) => name.toLowerCase())}::text[]))`;

/**
 * @description
 * Everything the list can be narrowed by, as SQL conditions on `novels n`. A novel with no chapter has no row in `chapters`, so a chapter-count lower bound of at least 1 selects from the grouped counts, while a bound that admits zero selects everything except the counts above the maximum.
 */
export function buildFilterConditions(
  filters?: NovelConnectionFilters,
): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];

  if (filters?.tagIn?.length) {
    conditions.push(tagNameIn(filters.tagIn));
  }

  if (filters?.tagNin?.length) {
    conditions.push(Prisma.sql`NOT ${tagNameIn(filters.tagNin)}`);
  }

  if (filters?.state) {
    conditions.push(
      Prisma.sql`n.state = ${filters.state}::"NovelState"`,
    );
  }

  if (filters?.ownerIds?.length) {
    conditions.push(
      Prisma.sql`n.writer_id IN (SELECT w.id FROM writers w WHERE w.user_id = ANY(${filters.ownerIds}::text[]))`,
    );
  }

  if (filters?.firstChapterCreatedFrom) {
    conditions.push(
      Prisma.sql`n.first_chapter_created_at >= ${filters.firstChapterCreatedFrom}`,
    );
  }

  if (filters?.firstChapterCreatedTo) {
    conditions.push(
      Prisma.sql`n.first_chapter_created_at <= ${filters.firstChapterCreatedTo}`,
    );
  }

  const chapterCount = buildChapterCountCondition(
    filters?.chapterCountMin,
    filters?.chapterCountMax,
  );

  if (chapterCount) {
    conditions.push(chapterCount);
  }

  return conditions;
}

function buildChapterCountCondition(
  min = 0,
  max?: number,
): Prisma.Sql | undefined {
  if (min > 0) {
    const upperBound =
      max === undefined
        ? Prisma.empty
        : Prisma.sql`AND COUNT(*) <= ${max}`;

    return Prisma.sql`n.id IN (
      SELECT novel_id FROM chapters
      GROUP BY novel_id
      HAVING COUNT(*) >= ${min} ${upperBound})`;
  }

  if (max !== undefined) {
    return Prisma.sql`n.id NOT IN (
      SELECT novel_id FROM chapters
      GROUP BY novel_id
      HAVING COUNT(*) > ${max})`;
  }

  return undefined;
}

/**
 * @description
 * The condition "strictly after the cursor row" in the order that is read. It compares against the cursor row's stored value through a subquery rather than a parameter: a JavaScript `Date` keeps milliseconds, the column microseconds, so an equality on the parameter would never match. A nullable column has its NULL rows last (first when reading backward), and the cursor row itself may be one of them.
 *
 * @throws {BadRequestException} When the cursor row no longer exists
 */
export async function buildAfterCursorCondition(
  prisma: PrismaTransactionClient,
  cursorId: string,
  order: NovelPageOrder,
  readingBackward: boolean,
): Promise<Prisma.Sql> {
  const column = SORT_COLUMNS[order.field];
  const [cursorRow] = await prisma.$queryRaw<{ isNull: boolean }[]>(
    Prisma.sql`SELECT ${column.sql} IS NULL AS "isNull" FROM novels n WHERE n.id = ${cursorId}::uuid`,
  );

  if (!cursorRow) {
    throw new BadRequestException(INVALID_CURSOR_MESSAGE);
  }

  const op = Prisma.raw(
    effectiveDirection(order.direction, readingBackward) ===
      OrderDirection.ASC
      ? '>'
      : '<',
  );
  const cursorValue = Prisma.sql`(SELECT ${column.sql} FROM novels n WHERE n.id = ${cursorId}::uuid)`;

  if (cursorRow.isNull) {
    const laterNulls = Prisma.sql`(${column.sql} IS NULL AND n.id ${op} ${cursorId}::uuid)`;

    return readingBackward
      ? Prisma.sql`(${column.sql} IS NOT NULL OR ${laterNulls})`
      : laterNulls;
  }

  const later = Prisma.sql`(${column.sql} ${op} ${cursorValue} OR (${column.sql} = ${cursorValue} AND n.id ${op} ${cursorId}::uuid))`;

  return column.nullable && !readingBackward
    ? Prisma.sql`(${later} OR ${column.sql} IS NULL)`
    : later;
}

export function buildOrderBy(
  order: NovelPageOrder,
  readingBackward: boolean,
): Prisma.Sql {
  const column = SORT_COLUMNS[order.field];
  const direction = Prisma.raw(
    effectiveDirection(order.direction, readingBackward),
  );
  const nulls = column.nullable
    ? Prisma.raw(readingBackward ? ' NULLS FIRST' : ' NULLS LAST')
    : Prisma.empty;

  return Prisma.sql`ORDER BY ${column.sql} ${direction}${nulls}, n.id ${direction}`;
}

/**
 * @description Paging backward reads the opposite order, nulls first, and the caller reverses the rows.
 */
export function effectiveDirection(
  direction: OrderDirection,
  readingBackward: boolean,
): OrderDirection {
  if (!readingBackward) {
    return direction;
  }

  return direction === OrderDirection.ASC
    ? OrderDirection.DESC
    : OrderDirection.ASC;
}

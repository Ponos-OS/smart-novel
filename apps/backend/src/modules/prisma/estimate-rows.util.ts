import { Prisma, PrismaClient } from '@prisma/client';

/**
 * @description
 * The planner's row estimate for `query`, from `EXPLAIN` instead of running it. `EXPLAIN` only plans the query, so its cost stays flat however many rows match, while counting visits every one of them. The price is accuracy: the estimate is only as fresh as the table statistics (`ANALYZE`), and the planner never goes below 1.
 *
 * @throws When the plan has no readable row estimate.
 */
export async function estimateRows(
  prisma: Pick<PrismaClient, '$queryRaw'>,
  query: Prisma.Sql,
): Promise<number> {
  const rows = await prisma.$queryRaw<
    { 'QUERY PLAN': { Plan: { 'Plan Rows': number } }[] }[]
  >(Prisma.sql`EXPLAIN (FORMAT JSON) ${query}`);
  const estimate = rows[0]?.['QUERY PLAN']?.[0]?.Plan?.['Plan Rows'];

  if (typeof estimate !== 'number' || !Number.isFinite(estimate)) {
    throw new Error('The query plan has no row estimate');
  }

  return Math.max(0, Math.round(estimate));
}

import { Prisma } from '@prisma/client';

import { estimateRows } from './estimate-rows.util';

describe(estimateRows.name, () => {
  const novelId = 'c1d31ec2-f478-4648-b90b-d1e53de2a829';
  const query = Prisma.sql`SELECT 1 FROM chapters WHERE novel_id = ${novelId}::uuid`;

  it('should read the row estimate of the plan, rounded', async () => {
    const prisma = {
      $queryRaw: vi
        .fn()
        .mockResolvedValue([
          { 'QUERY PLAN': [{ Plan: { 'Plan Rows': 41.6 } }] },
        ]),
    };

    const result = await estimateRows(prisma, query);

    expect(result).toBe(42);
    expect(prisma.$queryRaw.mock.calls[0][0].sql).toContain(
      'EXPLAIN (FORMAT JSON) SELECT 1 FROM chapters',
    );
  });

  it.each([
    { scenario: 'no rows', rows: [] },
    { scenario: 'no plan', rows: [{ 'QUERY PLAN': [] }] },
    {
      scenario: 'a plan row count that is not a number',
      rows: [{ 'QUERY PLAN': [{ Plan: { 'Plan Rows': 'many' } }] }],
    },
  ])('should throw for $scenario', async ({ rows }) => {
    const prisma = { $queryRaw: vi.fn().mockResolvedValue(rows) };

    const result = estimateRows(prisma, query);

    await expect(result).rejects.toThrow('no row estimate');
  });
});

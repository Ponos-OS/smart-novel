import {
  AuthorizationFixture,
  ClusterFixture,
  graphql,
} from '../support';

const STATS = `#graphql
  query ContentStats {
    contentStats {
      estimatedNovelCount
      estimatedChapterCount
    }
  }
`;
/**
 * @description The `where` of a history query for days from and to, which are inclusive.
 */
function days({ from, to }: { from?: string; to?: string }) {
  return { dayGTE: from, dayLTE: to };
}

/**
 * @description Days as the same ISO text whatever the precision the API answers with.
 */
function isoDay(day: string) {
  return new Date(day).toISOString();
}

const HISTORY = `#graphql
  query History(
    $first: Int
    $last: Int
    $after: Cursor
    $before: Cursor
    $where: StatsSnapshotWhereInput
  ) {
    statsSnapshots(
      first: $first
      last: $last
      after: $after
      before: $before
      where: $where
    ) {
      edges {
        cursor
        node {
          id
          day
          novelCount
          chapterCount
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;

describe('Content stats (e2e)', () => {
  const seededRange = {
    from: '2001-03-01T00:00:00.000Z',
    to: '2001-03-05T00:00:00.000Z',
  };
  const seededDays = [1, 2, 3, 4, 5].map((day) => `2001-03-0${day}`);
  let adminAuthorization: string;

  beforeAll(async () => {
    adminAuthorization =
      await AuthorizationFixture.getAdminAuthorizationHeader();
    ClusterFixture.queryDatabase(
      `INSERT INTO stats_snapshots (id, day, novel_count, chapter_count)
       VALUES ${seededDays
         .map(
           (day, index) =>
             `(gen_random_uuid(), '${day}', ${10 + index}, ${100 + index})`,
         )
         .join(', ')};`,
    );
  });

  afterAll(() => {
    ClusterFixture.queryDatabase(
      `DELETE FROM stats_snapshots WHERE day BETWEEN '2001-03-01' AND '2001-03-05';`,
    );
  });

  describe('who may read', () => {
    it.each([
      [
        'user',
        () => AuthorizationFixture.getUserAuthorizationHeader(),
      ],
      [
        'writer',
        () => AuthorizationFixture.getWriterAuthorizationHeader(),
      ],
    ])('should refuse a %s', async (_role, getAuthorization) => {
      const authorization = await getAuthorization();

      const responses = await Promise.all([
        graphql(STATS, {}, authorization),
        graphql(HISTORY, {}, authorization),
      ]);

      for (const data of responses) {
        expect(data.errors[0].extensions.code).toBe('FORBIDDEN');
        expect(data.errors[0].message).toContain('"admin" role');
      }
    });

    it('should refuse a caller without a token', async () => {
      const responses = await Promise.all([
        graphql(STATS, {}),
        graphql(HISTORY, {}),
      ]);

      for (const data of responses) {
        expect(data.errors).toHaveLength(1);
        expect(data.data).toBeNull();
      }
    });
  });

  describe('contentStats', () => {
    it('should return the estimates as whole numbers', async () => {
      const data = await graphql(STATS, {}, adminAuthorization);

      const { estimatedNovelCount, estimatedChapterCount } =
        data.data.contentStats;
      expect(Number.isInteger(estimatedNovelCount)).toBeTrue();
      expect(Number.isInteger(estimatedChapterCount)).toBeTrue();
      expect(estimatedNovelCount).toBeGreaterThanOrEqual(0);
      expect(estimatedChapterCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('statsSnapshots', () => {
    it('should return the days of a range oldest first with exact counts', async () => {
      const data = await graphql(
        HISTORY,
        { where: days(seededRange) },
        adminAuthorization,
      );

      const nodes = data.data.statsSnapshots.edges.map(
        (edge: { node: { day: string } }) => ({
          ...edge.node,
          day: isoDay(edge.node.day),
        }),
      );
      expect(nodes).toEqual(
        seededDays.map((day, index) => ({
          id: expect.any(String),
          day: `${day}T00:00:00.000Z`,
          novelCount: 10 + index,
          chapterCount: 100 + index,
        })),
      );
    });

    it('should return the newest two days of the range, still oldest first', async () => {
      const data = await graphql(
        HISTORY,
        { last: 2, where: days(seededRange) },
        adminAuthorization,
      );

      const connection = data.data.statsSnapshots;
      expect(
        connection.edges.map((edge: { node: { day: string } }) =>
          isoDay(edge.node.day),
        ),
      ).toEqual([
        '2001-03-04T00:00:00.000Z',
        '2001-03-05T00:00:00.000Z',
      ]);
      expect(connection.pageInfo.hasPreviousPage).toBeTrue();
    });

    it('should narrow the days to the range', async () => {
      const data = await graphql(
        HISTORY,
        {
          where: days({
            from: '2001-03-02T18:00:00.000Z',
            to: '2001-03-03T06:00:00.000Z',
          }),
        },
        adminAuthorization,
      );

      expect(
        data.data.statsSnapshots.edges.map(
          (edge: { node: { day: string } }) => isoDay(edge.node.day),
        ),
      ).toEqual([
        '2001-03-02T00:00:00.000Z',
        '2001-03-03T00:00:00.000Z',
      ]);
    });

    it('should page forward with the cursor', async () => {
      const first = await graphql(
        HISTORY,
        { first: 2, where: days(seededRange) },
        adminAuthorization,
      );
      const { endCursor } = first.data.statsSnapshots.pageInfo;

      const second = await graphql(
        HISTORY,
        { first: 2, after: endCursor, where: days(seededRange) },
        adminAuthorization,
      );

      expect(
        second.data.statsSnapshots.edges.map(
          (edge: { node: { day: string } }) => isoDay(edge.node.day),
        ),
      ).toEqual([
        '2001-03-03T00:00:00.000Z',
        '2001-03-04T00:00:00.000Z',
      ]);
    });

    it('should refuse a range that ends before it starts', async () => {
      const data = await graphql(
        HISTORY,
        {
          where: days({
            from: '2001-03-05T00:00:00.000Z',
            to: '2001-03-01T00:00:00.000Z',
          }),
        },
        adminAuthorization,
      );

      expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
    });
  });
});

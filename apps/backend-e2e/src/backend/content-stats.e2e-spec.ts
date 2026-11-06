import axios from 'axios';

import { AuthorizationFixture, ClusterFixture } from '../support';

const STATS = `#graphql
  query ContentStats {
    contentStats {
      estimatedNovelCount
      estimatedChapterCount
    }
  }
`;
const HISTORY = `#graphql
  query History(
    $first: Int
    $last: Int
    $after: String
    $before: String
    $filters: StatsHistoryFiltersInput
  ) {
    statsSnapshotsConnection(
      first: $first
      last: $last
      after: $after
      before: $before
      filters: $filters
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

async function graphql(
  query: string,
  variables: Record<string, unknown>,
  authorization?: string,
) {
  const { data } = await axios.post(
    '/graphql',
    { query, variables },
    {
      headers: authorization ? { Authorization: authorization } : {},
      validateStatus: () => true,
    },
  );

  return data;
}

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

  describe('statsSnapshotsConnection', () => {
    it('should return the days of a range oldest first with exact counts', async () => {
      const data = await graphql(
        HISTORY,
        { filters: seededRange },
        adminAuthorization,
      );

      const nodes = data.data.statsSnapshotsConnection.edges.map(
        (edge: { node: unknown }) => edge.node,
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
        { last: 2, filters: seededRange },
        adminAuthorization,
      );

      const connection = data.data.statsSnapshotsConnection;
      expect(
        connection.edges.map(
          (edge: { node: { day: string } }) => edge.node.day,
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
          filters: {
            from: '2001-03-02T18:00:00.000Z',
            to: '2001-03-03T06:00:00.000Z',
          },
        },
        adminAuthorization,
      );

      expect(
        data.data.statsSnapshotsConnection.edges.map(
          (edge: { node: { day: string } }) => edge.node.day,
        ),
      ).toEqual([
        '2001-03-02T00:00:00.000Z',
        '2001-03-03T00:00:00.000Z',
      ]);
    });

    it('should page forward with the cursor', async () => {
      const first = await graphql(
        HISTORY,
        { first: 2, filters: seededRange },
        adminAuthorization,
      );
      const { endCursor } =
        first.data.statsSnapshotsConnection.pageInfo;

      const second = await graphql(
        HISTORY,
        { first: 2, after: endCursor, filters: seededRange },
        adminAuthorization,
      );

      expect(
        second.data.statsSnapshotsConnection.edges.map(
          (edge: { node: { day: string } }) => edge.node.day,
        ),
      ).toEqual([
        '2001-03-03T00:00:00.000Z',
        '2001-03-04T00:00:00.000Z',
      ]);
    });

    it('should refuse a cursor after the range changed', async () => {
      const first = await graphql(
        HISTORY,
        { first: 2, filters: seededRange },
        adminAuthorization,
      );
      const { endCursor } =
        first.data.statsSnapshotsConnection.pageInfo;

      const data = await graphql(
        HISTORY,
        {
          first: 2,
          after: endCursor,
          filters: { ...seededRange, to: '2001-03-04T00:00:00.000Z' },
        },
        adminAuthorization,
      );

      expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
      expect(data.errors[0].message).toContain('Invalid cursor');
    });
  });
});

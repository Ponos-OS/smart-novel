import axios from 'axios';
import { randomUUID } from 'node:crypto';

import { AuthorizationFixture } from '../support';

const NOVEL_LIST = `#graphql
  query NovelList(
    $first: Int
    $last: Int
    $after: String
    $before: String
    $filters: NovelFiltersInput
    $orderBy: NovelOrderByInput
  ) {
    novelsConnection(
      first: $first
      last: $last
      after: $after
      before: $before
      filters: $filters
      orderBy: $orderBy
    ) {
      edges {
        cursor
        node {
          id
          name
          state
          firstChapterCreatedAt
          estimatedChapterCount
          license {
            id
            name
          }
          writer {
            userId
            penName
            name
            email
          }
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
const WHO_AM_I = `#graphql
  query WhoAmI {
    whoAmI {
      sub
      email
    }
  }
`;
const CREATE_NOVEL = `#graphql
  mutation CreateNovel($input: CreateNovelInput!) {
    createNovel(input: $input) {
      id
    }
  }
`;
const CREATE_CHAPTER = `#graphql
  mutation CreateChapter($novelId: ID!, $input: CreateChapterInput!) {
    createChapter(novelId: $novelId, input: $input) {
      id
    }
  }
`;
const DELETE_NOVEL = `#graphql
  mutation DeleteNovel($id: ID!) {
    deleteNovel(id: $id) {
      id
    }
  }
`;

interface NovelNode {
  id: string;
  name: string;
  state: string;
  firstChapterCreatedAt: string | null;
  estimatedChapterCount: number;
  license: { id: string; name: string };
  writer: {
    userId: string;
    penName: string;
    name: string | null;
    email: string | null;
  };
}

interface NovelPage {
  edges: { cursor: string; node: NovelNode }[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
}

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

describe('Novel list (e2e)', () => {
  const runId = randomUUID().slice(0, 8);
  const byFirstChapter = (direction: 'ASC' | 'DESC') => ({
    field: 'FIRST_CHAPTER_CREATED_AT',
    direction,
  });
  let admin: string;
  let owner: string;
  let ownerId: string;
  let ownerEmail: string;
  let emptyNovelId: string;
  let finishedNovelId: string;
  let ongoingNovelId: string;
  let finishedFirstChapterAt: string;
  let betweenFirstChaptersAt: string;
  const createdIds: string[] = [];

  async function createNovel(
    name: string,
    chapters: number,
    state = 'ONGOING',
  ): Promise<string> {
    const created = await graphql(
      CREATE_NOVEL,
      {
        input: {
          name: `${name} ${runId}`,
          description: 'A caravan crosses a dry sea bed.',
          state,
        },
      },
      owner,
    );
    const novelId = created.data.createNovel.id;
    createdIds.push(novelId);

    for (let number = 1; number <= chapters; number++) {
      await graphql(
        CREATE_CHAPTER,
        {
          novelId,
          input: {
            title: `Chapter ${number}`,
            content: `# Chapter ${number}\n\nText.`,
          },
        },
        owner,
      );
    }

    return novelId;
  }

  /**
   * @description The novels of the second writer, as `authorization` sees them (anonymous when it is undefined).
   */
  async function list(
    variables: Record<string, unknown> = {},
    authorization?: string,
  ): Promise<NovelPage> {
    const data = await graphql(
      NOVEL_LIST,
      {
        first: 100,
        ...variables,
        filters: {
          ownerIds: [ownerId],
          ...(variables.filters as object),
        },
      },
      authorization,
    );

    expect(data.errors).toBeUndefined();

    return data.data.novelsConnection;
  }

  async function listMine(
    variables: Record<string, unknown> = {},
    authorization?: string,
  ) {
    const { edges } = await list(variables, authorization);
    const mine = new Set(createdIds);

    return edges
      .map(({ node }) => node.id)
      .filter((id) => mine.has(id));
  }

  beforeAll(async () => {
    admin = await AuthorizationFixture.getAdminAuthorizationHeader();
    owner =
      await AuthorizationFixture.getSecondWriterAuthorizationHeader();
    const me = await graphql(WHO_AM_I, {}, owner);
    ownerId = me.data.whoAmI.sub;
    ownerEmail = me.data.whoAmI.email;

    emptyNovelId = await createNovel('Empty', 0);
    finishedNovelId = await createNovel('Finished', 2, 'FINISHED');
    ongoingNovelId = await createNovel('Ongoing', 3);
    const everything = await list();
    const dateOf = (id: string) =>
      new Date(
        everything.edges.find(({ node }) => node.id === id)!.node
          .firstChapterCreatedAt!,
      );
    finishedFirstChapterAt = dateOf(finishedNovelId).toISOString();
    // The column keeps microseconds and a JavaScript date milliseconds, so a bound is only unambiguous between two novels.
    betweenFirstChaptersAt = new Date(
      (dateOf(finishedNovelId).getTime() +
        dateOf(ongoingNovelId).getTime()) /
        2,
    ).toISOString();
  });

  afterAll(async () => {
    await Promise.all(
      createdIds.map((id) => graphql(DELETE_NOVEL, { id }, admin)),
    );
  });

  describe('what a row shows', () => {
    it('should give the license, the estimated chapters and only the pen name of the writer to an anonymous caller', async () => {
      const { edges } = await list();

      const mine = edges
        .map(({ node }) => node)
        .filter(({ id }) => createdIds.includes(id));
      expect(mine).toHaveLength(3);
      for (const node of mine) {
        expect(node.license.name).toBeString();
        expect(node.estimatedChapterCount).toBeNumber();
        expect(node.writer).toStrictEqual({
          userId: ownerId,
          penName: 'Writer_Two',
          name: null,
          email: null,
        });
      }
    });

    it('should give an admin the name and email of the writer too', async () => {
      const { edges } = await list({}, admin);

      const node = edges.find(
        ({ node }) => node.id === emptyNovelId,
      )!.node;
      expect(node.writer).toStrictEqual({
        userId: ownerId,
        penName: 'Writer_Two',
        name: 'Writer Two',
        email: ownerEmail,
      });
    });

    it('should show the novels of every writer when no owner is asked for', async () => {
      const data = await graphql(NOVEL_LIST, { first: 100 });

      const owners = new Set(
        data.data.novelsConnection.edges.map(
          ({ node }: { node: NovelNode }) => node.writer?.userId,
        ),
      );
      expect(data.errors).toBeUndefined();
      expect(owners.size).toBeGreaterThan(1);
    });

    it('should leave the first chapter date empty until the novel has a chapter', async () => {
      const { edges } = await list();

      const dates = Object.fromEntries(
        edges.map(({ node }) => [
          node.id,
          node.firstChapterCreatedAt,
        ]),
      );
      expect(dates[emptyNovelId]).toBeNull();
      expect(dates[finishedNovelId]).toBeString();
    });
  });

  describe('filters, open to every caller', () => {
    it.each([
      {
        scenario: 'at least two chapters',
        filters: { chapterCount: { min: 2 } },
        expected: () => [finishedNovelId, ongoingNovelId],
      },
      {
        scenario:
          'at most two chapters, which keeps the novel with none',
        filters: { chapterCount: { max: 2 } },
        expected: () => [emptyNovelId, finishedNovelId],
      },
      {
        scenario: 'one or two chapters',
        filters: { chapterCount: { min: 1, max: 2 } },
        expected: () => [finishedNovelId],
      },
      {
        scenario: 'no chapter at all',
        filters: { chapterCount: { min: 0, max: 0 } },
        expected: () => [emptyNovelId],
      },
      {
        scenario: 'the finished state',
        filters: { state: 'FINISHED' },
        expected: () => [finishedNovelId],
      },
      {
        scenario:
          'a first chapter from a date, which leaves out the novel with none',
        filters: () => ({
          firstChapterCreatedAt: { from: finishedFirstChapterAt },
        }),
        expected: () => [finishedNovelId, ongoingNovelId],
      },
      {
        scenario: 'a first chapter after a date between the two',
        filters: () => ({
          firstChapterCreatedAt: { from: betweenFirstChaptersAt },
        }),
        expected: () => [ongoingNovelId],
      },
      {
        scenario: 'a first chapter up to a date between the two',
        filters: () => ({
          firstChapterCreatedAt: { to: betweenFirstChaptersAt },
        }),
        expected: () => [finishedNovelId],
      },
    ])(
      'should keep only novels with $scenario, for an anonymous caller',
      async ({ filters, expected }) => {
        const resolved =
          typeof filters === 'function' ? filters() : filters;

        const ids = await listMine({ filters: resolved });

        expect([...ids].sort()).toStrictEqual([...expected()].sort());
      },
    );

    it('should give the same to an admin', async () => {
      const ids = await listMine(
        { filters: { chapterCount: { min: 2 } } },
        admin,
      );

      expect([...ids].sort()).toStrictEqual(
        [finishedNovelId, ongoingNovelId].sort(),
      );
    });

    it('should list nothing for a writer without novels', async () => {
      const { edges } = await list({
        filters: { ownerIds: ['111111111111111111'] },
      });

      expect(edges).toBeEmpty();
    });

    it('should list the novels of several writers at once', async () => {
      const writer =
        await AuthorizationFixture.getWriterAuthorizationHeader();
      const otherId = (await graphql(WHO_AM_I, {}, writer)).data
        .whoAmI.sub;

      const { edges } = await list({
        filters: { ownerIds: [ownerId, otherId] },
      });

      const owners = new Set(
        edges.map(({ node }) => node.writer.userId),
      );
      expect(owners).toStrictEqual(new Set([ownerId, otherId]));
    });

    it('should not narrow the list when the list of owners is empty', async () => {
      const { edges } = await list({ filters: { ownerIds: [] } });

      const owners = new Set(
        edges.map(({ node }) => node.writer.userId),
      );
      expect(owners.size).toBeGreaterThan(1);
    });

    it.each([
      {
        scenario: 'a maximum below the minimum',
        filters: { chapterCount: { min: 5, max: 1 } },
      },
      {
        scenario: 'an end date before the start date',
        filters: {
          firstChapterCreatedAt: {
            from: '2026-06-30T00:00:00.000Z',
            to: '2026-01-01T00:00:00.000Z',
          },
        },
      },
      {
        scenario: 'an owner that is not a user ID',
        filters: { ownerIds: ['mina'] },
      },
      {
        scenario: 'a category name with a NUL character',
        filters: { category: { in: ['\u0000'] } },
      },
      {
        scenario: 'more than 100 owners',
        filters: {
          ownerIds: Array.from(
            { length: 101 },
            (_, i) => `${1000 + i}`,
          ),
        },
      },
    ])('should refuse $scenario', async ({ filters }) => {
      const data = await graphql(NOVEL_LIST, { first: 1, filters });

      expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
    });
  });

  describe('order and paging', () => {
    it('should list by name by default, as it always did', async () => {
      const ids = await listMine();

      expect(ids).toStrictEqual([
        emptyNovelId,
        finishedNovelId,
        ongoingNovelId,
      ]);
    });

    it('should list by name backward when asked', async () => {
      const ids = await listMine({
        orderBy: { field: 'NAME', direction: 'DESC' },
      });

      expect(ids).toStrictEqual([
        ongoingNovelId,
        finishedNovelId,
        emptyNovelId,
      ]);
    });

    it('should list the newest first chapter first, novels with none last', async () => {
      const ids = await listMine({ orderBy: byFirstChapter('DESC') });

      expect(ids).toStrictEqual([
        ongoingNovelId,
        finishedNovelId,
        emptyNovelId,
      ]);
    });

    it('should list the oldest first chapter first, novels with none still last', async () => {
      const ids = await listMine({ orderBy: byFirstChapter('ASC') });

      expect(ids).toStrictEqual([
        finishedNovelId,
        ongoingNovelId,
        emptyNovelId,
      ]);
    });

    it.each([
      { field: 'NAME', direction: 'ASC' },
      { field: 'NAME', direction: 'DESC' },
      { field: 'FIRST_CHAPTER_CREATED_AT', direction: 'DESC' },
      { field: 'FIRST_CHAPTER_CREATED_AT', direction: 'ASC' },
    ])(
      'should page $field $direction one at a time, across the novels with a date and the ones without, in both directions',
      async (orderBy) => {
        const whole = (await list({ orderBy })).edges.map(
          ({ node }) => node.id,
        );

        const forward: string[] = [];
        let after: string | undefined;
        for (;;) {
          const page = await list({ first: 1, after, orderBy });
          forward.push(...page.edges.map(({ node }) => node.id));
          if (!page.pageInfo.hasNextPage) break;
          after = page.pageInfo.endCursor!;
        }

        const backward: string[] = [];
        let before: string | undefined;
        for (;;) {
          const page = await list({
            first: undefined,
            last: 1,
            before,
            orderBy,
          });
          backward.unshift(...page.edges.map(({ node }) => node.id));
          if (!page.pageInfo.hasPreviousPage) break;
          before = page.pageInfo.startCursor!;
        }

        expect(forward).toStrictEqual(whole);
        expect(backward).toStrictEqual(whole);
        expect(whole).toIncludeAllMembers(createdIds);
      },
    );

    it('should refuse a cursor issued for other filters', async () => {
      const page = await list({
        first: 1,
        filters: { state: 'ONGOING' },
      });

      const data = await graphql(NOVEL_LIST, {
        first: 1,
        after: page.pageInfo.endCursor,
        filters: { ownerIds: [ownerId], state: 'FINISHED' },
      });

      expect(data.errors[0].message).toContain('Invalid cursor');
    });

    it('should refuse a cursor issued for another sort', async () => {
      const page = await list({ first: 1 });

      const data = await graphql(NOVEL_LIST, {
        first: 1,
        after: page.pageInfo.endCursor,
        filters: { ownerIds: [ownerId] },
        orderBy: byFirstChapter('ASC'),
      });

      expect(data.errors[0].message).toContain('Invalid cursor');
    });

    it('should give a page of 20 when no size is asked for, and refuse one over 100', async () => {
      const unbounded = await graphql(NOVEL_LIST, {});
      const tooBig = await graphql(NOVEL_LIST, { first: 101 });

      expect(
        unbounded.data.novelsConnection.edges.length,
      ).toBeLessThanOrEqual(20);
      expect(tooBig.errors[0].extensions.code).toBe('BAD_REQUEST');
    });
  });
});

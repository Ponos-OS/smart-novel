import axios from 'axios';

import { AuthorizationFixture } from '../support';

const novelId = 'c1d31ec2-f478-4648-b90b-d1e53de2a829';
const notAUuid = Buffer.from('example-novel').toString('base64');
const uuidCursor = Buffer.from(
  'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
).toString('base64');

const NOVELS = `#graphql
  query Novels($after: String, $before: String) {
    novelsConnection(first: 1, after: $after, before: $before) {
      edges {
        cursor
      }
    }
  }
`;

const CHAPTERS = `#graphql
  query Chapters($after: String, $before: String) {
    novel(id: "${novelId}") {
      chaptersConnection(first: 1, after: $after, before: $before) {
        edges {
          cursor
        }
      }
    }
  }
`;

const TAGS = `#graphql
  query Tags($after: String, $before: String) {
    tagsConnection(first: 1, after: $after, before: $before) {
      edges {
        cursor
      }
    }
  }
`;

const LICENSE_DRAFTS = `#graphql
  query LicenseDrafts($after: String, $before: String) {
    licenseDraftsConnection(first: 1, after: $after, before: $before) {
      edges {
        cursor
      }
    }
  }
`;

const WRITERS = `#graphql
  query Writers($after: String, $before: String) {
    writersConnection(first: 1, after: $after, before: $before) {
      edges {
        cursor
      }
    }
  }
`;

const CHAPTERS_PAGE = `#graphql
  query ChaptersPage(
    $novelId: ID!
    $after: String
    $direction: OrderDirection!
  ) {
    novel(id: $novelId) {
      chaptersConnection(
        first: 1
        after: $after
        orderBy: { field: CHAPTER_NUMBER, direction: $direction }
      ) {
        edges {
          cursor
        }
      }
    }
  }
`;

const NOVEL_IDS = `#graphql
  query NovelIds {
    novelsConnection(first: 2) {
      edges {
        node {
          id
        }
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

describe('Cursor validation (e2e)', () => {
  const connections: [
    string,
    string,
    () => Promise<string | undefined>,
  ][] = [
    ['novelsConnection', NOVELS, async () => undefined],
    ['chaptersConnection', CHAPTERS, async () => undefined],
    ['tagsConnection', TAGS, async () => undefined],
    [
      'licenseDraftsConnection',
      LICENSE_DRAFTS,
      () => AuthorizationFixture.getWriterAuthorizationHeader(),
    ],
    [
      'writersConnection',
      WRITERS,
      () => AuthorizationFixture.getAdminAuthorizationHeader(),
    ],
  ];

  describe.each(connections)('%s', (_name, query, authorize) => {
    it.each([
      ['after', { after: notAUuid }],
      ['before', { before: notAUuid }],
      ['after', { after: 'not-base64!!' }],
    ])(
      'should answer a malformed %s cursor with a bad request',
      async (_arg, variables) => {
        const data = await graphql(
          query,
          variables,
          await authorize(),
        );

        expect(data.errors[0].message).toBe('Invalid cursor');
        expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
      },
    );

    it('should refuse after and before together', async () => {
      const data = await graphql(
        query,
        { after: uuidCursor, before: uuidCursor },
        await authorize(),
      );

      expect(data.errors[0].message).toBe(
        'after and before cannot be used together',
      );
      expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
    });
  });

  describe('issued cursors', () => {
    async function issuedCursor(query: string, path: string[]) {
      const data = await graphql(query, {});
      const edges = path.reduce((node, key) => node[key], data.data);

      return edges.edges[0].cursor as string;
    }

    it('should accept a cursor it issued', async () => {
      const cursor = await issuedCursor(NOVELS, ['novelsConnection']);

      const data = await graphql(NOVELS, { after: cursor });

      expect(data.errors).toBeUndefined();
    });

    it('should refuse an issued cursor whose last character was changed', async () => {
      const cursor = await issuedCursor(NOVELS, ['novelsConnection']);
      const tampered = `${cursor.slice(0, -1)}${cursor.endsWith('A') ? 'B' : 'A'}`;

      const data = await graphql(NOVELS, { after: tampered });

      expect(data.errors[0].message).toBe('Invalid cursor');
      expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
    });

    it('should refuse a chapters cursor used with another order', async () => {
      const first = await graphql(CHAPTERS_PAGE, {
        novelId,
        direction: 'ASC',
      });
      const cursor =
        first.data.novel.chaptersConnection.edges[0].cursor;

      const data = await graphql(CHAPTERS_PAGE, {
        novelId,
        direction: 'DESC',
        after: cursor,
      });

      expect(data.errors[0].message).toBe('Invalid cursor');
      expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
    });

    it('should refuse a chapters cursor used for another novel', async () => {
      const first = await graphql(CHAPTERS_PAGE, {
        novelId,
        direction: 'ASC',
      });
      const cursor =
        first.data.novel.chaptersConnection.edges[0].cursor;
      const novels = await graphql(NOVEL_IDS, {});
      const otherNovelId = novels.data.novelsConnection.edges
        .map(({ node }: { node: { id: string } }) => node.id)
        .find((id: string) => id !== novelId);

      const data = await graphql(CHAPTERS_PAGE, {
        novelId: otherNovelId,
        direction: 'ASC',
        after: cursor,
      });

      expect(data.errors[0].message).toBe('Invalid cursor');
      expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
    });

    it('should refuse a cursor issued by another connection', async () => {
      const cursor = await issuedCursor(TAGS, ['tagsConnection']);

      const data = await graphql(NOVELS, { after: cursor });

      expect(data.errors[0].message).toBe('Invalid cursor');
      expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
    });
  });
});

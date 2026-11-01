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

const CATEGORIES = `#graphql
  query Categories($after: String, $before: String) {
    categoriesConnection(first: 1, after: $after, before: $before) {
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

const WRITER_REQUESTS = `#graphql
  query WriterRequests($after: String, $before: String) {
    writerRequestsConnection(first: 1, after: $after, before: $before) {
      edges {
        cursor
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
    ['categoriesConnection', CATEGORIES, async () => undefined],
    [
      'licenseDraftsConnection',
      LICENSE_DRAFTS,
      () => AuthorizationFixture.getWriterAuthorizationHeader(),
    ],
    [
      'writerRequestsConnection',
      WRITER_REQUESTS,
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

    it('should refuse a cursor issued by another connection', async () => {
      const cursor = await issuedCursor(CATEGORIES, [
        'categoriesConnection',
      ]);

      const data = await graphql(NOVELS, { after: cursor });

      expect(data.errors[0].message).toBe('Invalid cursor');
      expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
    });
  });
});

import { graphql, NovelFixture } from '../support';

const notAUuid = Buffer.from('example-novel').toString('base64');
const uuidCursor = Buffer.from(
  'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
).toString('base64');

const NOVELS = `#graphql
  query Novels($after: Cursor, $before: Cursor) {
    novels(first: 1, after: $after, before: $before) {
      edges {
        cursor
      }
    }
  }
`;

const CHAPTERS = `#graphql
  query Chapters($novelId: ID!, $after: Cursor, $before: Cursor) {
    novel(id: $novelId) {
      chapters(first: 1, after: $after, before: $before) {
        edges {
          cursor
        }
      }
    }
  }
`;

const TAGS = `#graphql
  query Tags($after: Cursor, $before: Cursor) {
    tags(first: 1, after: $after, before: $before) {
      edges {
        cursor
      }
    }
  }
`;

describe('Cursor validation (e2e)', () => {
  let novelId: string;

  beforeAll(async () => {
    ({ novelId } = await NovelFixture.create());
  });

  const connections: [string, string][] = [
    ['novels', NOVELS],
    ['chapters', CHAPTERS],
    ['tags', TAGS],
  ];

  describe.each(connections)('%s', (_name, query) => {
    it.each([
      ['after', { after: notAUuid }],
      ['before', { before: notAUuid }],
      ['after', { after: 'not-base64!!' }],
      ['after', { after: uuidCursor }],
    ])(
      'should answer a malformed %s cursor with INVALID_CURSOR',
      async (_arg, variables) => {
        const data = await graphql(query, { novelId, ...variables });

        expect(data.errors[0].message).toBe('Invalid cursor');
        expect(data.errors[0].extensions.code).toBe('INVALID_CURSOR');
      },
    );
  });

  it('should accept a cursor it issued', async () => {
    const first = await graphql(NOVELS, {});
    const cursor = first.data.novels.edges[0].cursor as string;

    const data = await graphql(NOVELS, { after: cursor });

    expect(data.errors).toBeUndefined();
  });
});

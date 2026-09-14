import axios from 'axios';
import { isString } from 'class-validator';

describe('Novel (e2e)', () => {
  const NOVEL_ID = 'c1d31ec2-f478-4648-b90b-d1e53de2a829'; // example-novel from seed data

  it('should find a novel by ID', async () => {
    const res = await axios.post('/graphql', {
      query: `#graphql
        query GetNovel($id: ID!) {
          novel(id: $id) {
            id
            name
            description
            state
            author
            category
            chaptersConnection(first: 10, orderBy: { field: CHAPTER_NUMBER, direction: ASC }) {
              edges {
                cursor
                node {
                  id
                  title
                  chapterNumber
                  createdAt
                }
              }
              pageInfo {
                endCursor
                startCursor
                hasNextPage
                hasPreviousPage
              }
              totalCount
            }
            lastChapterPublishedAt
            lastPublishedChapter {
              id
            }
            firstChapter {
              id
            }
          }
        }
      `,
      variables: {
        id: NOVEL_ID,
      },
    });

    const novel = res.data.data.novel;
    expect(novel).toStrictEqual(
      expect.objectContaining({
        id: 'c1d31ec2-f478-4648-b90b-d1e53de2a829',
        name: 'The Journey Begins',
        description:
          'A young hero leaves home to uncover an ancient mystery and shape the fate of the realm.',
        state: 'ONGOING',
        author: 'Jane Doe',
        category: expect.arrayContaining(['fantasy', 'adventure']),
        lastPublishedChapter: {
          id: '6d908673-b125-4729-9da9-4fb907afe2a1',
        },
        firstChapter: { id: '4dd92f16-4743-47b9-960c-6529678e9bc5' },
      }),
    );
    expect(novel.lastChapterPublishedAt).toBeDateString();

    // Verify chaptersConnection
    expect(
      novel.chaptersConnection.totalCount,
    ).toBeGreaterThanOrEqual(4);
    expect(
      novel.chaptersConnection.edges.length,
    ).toBeGreaterThanOrEqual(4);

    const chapterIds = novel.chaptersConnection.edges.map(
      (edge: { node: { id: string } }) => edge.node.id,
    );
    expect(chapterIds).toContain(
      '4dd92f16-4743-47b9-960c-6529678e9bc5',
    );
    expect(chapterIds).toContain(
      '4769a024-6267-4abc-a412-5ab0241a8d0e',
    );
    expect(chapterIds).toContain(
      'a3987a2f-eaa5-4a05-8714-34a110511cba',
    );
    expect(chapterIds).toContain(
      '038dd3f5-e921-4076-be91-66175ebd1bc3',
    );

    // Each edge should have cursor and node with expected fields
    for (const edge of novel.chaptersConnection.edges) {
      expect(edge.cursor).toBeString();
      expect(edge.node.id).toBeString();
      expect(edge.node.title).toBeString();
      expect(edge.node.chapterNumber).toBeNumber();
      expect(edge.node.createdAt).toBeDateString();
    }
  });

  it('should download the cover image', async () => {
    const { data } = await axios.post('/graphql', {
      query: `#graphql
        query GetNovel($id: ID!) {
          novel(id: $id) {
            coverUrl
          }
        }
      `,
      variables: {
        id: NOVEL_ID,
      },
    });

    const res = await axios.get(data.data.novel.coverUrl);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
  }, 120_000);

  it('should return all categories', async () => {
    const res = await axios.post('/graphql', {
      query: `#graphql
        query {
          categories
        }
      `,
    });

    expect(res.data.data.categories).toBeArray();
    expect(res.data.data.categories).toSatisfyAll(isString);
  });
});

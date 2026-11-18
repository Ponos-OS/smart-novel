import axios from 'axios';

import { AuthorizationFixture, NovelFixture } from '../../support';

describe('Novel (e2e)', () => {
  let NOVEL_ID: string;
  let CHAPTER_IDS: string[];

  beforeAll(async () => {
    const { novelId, chapterIds } = await NovelFixture.create({
      chapters: 4,
      tags: ['fantasy', 'adventure'],
    });
    NOVEL_ID = novelId;
    CHAPTER_IDS = chapterIds;
  });

  it('should find a novel by ID', async () => {
    const res = await axios.post('/graphql', {
      query: `#graphql
        query GetNovel($id: ID!) {
          novel(id: $id) {
            id
            name
            description
            state
            writer {
              penName
            }
            tags {
              name
            }
            chapters(first: 10, orderBy: { field: CHAPTER_NUMBER, direction: ASC }) {
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
        id: NOVEL_ID,
        name: expect.stringMatching(/^The Salt Road /),
        description: 'A caravan crosses a dry sea bed.',
        state: 'ONGOING',
        writer: { penName: 'Writer_User' },
        tags: expect.arrayContaining([
          { name: 'fantasy' },
          { name: 'adventure' },
        ]),
        lastPublishedChapter: { id: CHAPTER_IDS[3] },
        firstChapter: { id: CHAPTER_IDS[0] },
      }),
    );
    expect(novel.lastChapterPublishedAt).toBeDateString();

    // Verify chapters
    expect(novel.chapters.totalCount).toBe(4);
    expect(novel.chapters.edges.length).toBe(4);

    const chapterIds = novel.chapters.edges.map(
      (edge: { node: { id: string } }) => edge.node.id,
    );
    expect(chapterIds).toStrictEqual(CHAPTER_IDS);

    // Each edge should have cursor and node with expected fields
    for (const edge of novel.chapters.edges) {
      expect(edge.cursor).toBeString();
      expect(edge.node.id).toBeString();
      expect(edge.node.title).toBeString();
      expect(edge.node.chapterNumber).toBeNumber();
      expect(edge.node.createdAt).toBeDateString();
    }
  });

  it('should download the cover image', async () => {
    const { novelId: coverNovelId } = await NovelFixture.seeded({
      authorization:
        await AuthorizationFixture.getWriterAuthorizationHeader(),
    });
    const { data } = await axios.post('/graphql', {
      query: `#graphql
        query GetNovel($id: ID!) {
          novel(id: $id) {
            coverURL
          }
        }
      `,
      variables: {
        id: coverNovelId,
      },
    });

    const res = await axios.get(data.data.novel.coverURL);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
  }, 120_000);
});

import axios from 'axios';

import { AuthorizationFixture } from '../support';

const CREATE_NOVEL = `#graphql
  mutation CreateNovel($input: CreateNovelInput!) {
    createNovel(input: $input) {
      id
      firstChapterCreatedAt
    }
  }
`;
const CREATE_CHAPTER = `#graphql
  mutation CreateChapter($novelId: ID!, $input: CreateChapterInput!) {
    createChapter(novelId: $novelId, input: $input) {
      id
      createdAt
    }
  }
`;
const DELETE_CHAPTER = `#graphql
  mutation DeleteChapter($id: ID!) {
    deleteChapter(id: $id) {
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
const NOVEL_FIRST_CHAPTER_CREATED_AT = `#graphql
  query NovelFirstChapterCreatedAt($id: ID!) {
    novel(id: $id) {
      firstChapterCreatedAt
    }
  }
`;

async function graphql(
  query: string,
  variables: Record<string, unknown>,
  authorization: string,
) {
  const { data } = await axios.post(
    '/graphql',
    { query, variables },
    { headers: { Authorization: authorization } },
  );

  expect(data.errors).toBeUndefined();

  return data.data;
}

describe('Novel firstChapterCreatedAt (e2e)', () => {
  let writer: string;
  let novelId: string;

  async function createChapter(title: string) {
    const data = await graphql(
      CREATE_CHAPTER,
      { novelId, input: { title, content: `# ${title}\n\nText.` } },
      writer,
    );

    return data.createChapter as { id: string; createdAt: string };
  }

  async function getFirstChapterCreatedAt(): Promise<string | null> {
    const data = await graphql(
      NOVEL_FIRST_CHAPTER_CREATED_AT,
      { id: novelId },
      writer,
    );

    return data.novel.firstChapterCreatedAt;
  }

  beforeAll(async () => {
    writer =
      await AuthorizationFixture.getWriterAuthorizationHeader();
    const data = await graphql(
      CREATE_NOVEL,
      {
        input: {
          name: 'The Salt Road',
          description: 'A caravan crosses a dry sea bed.',
        },
      },
      writer,
    );
    novelId = data.createNovel.id;
  });

  afterAll(async () => {
    await graphql(DELETE_NOVEL, { id: novelId }, writer);
  });

  it('should follow the first chapter as chapters are added and deleted', async () => {
    const beforeAnyChapter = await getFirstChapterCreatedAt();

    const first = await createChapter('Departure');
    const second = await createChapter('The Dry Sea');
    const afterTwoChapters = await getFirstChapterCreatedAt();
    await graphql(DELETE_CHAPTER, { id: first.id }, writer);
    const afterFirstDeleted = await getFirstChapterCreatedAt();
    await graphql(DELETE_CHAPTER, { id: second.id }, writer);
    const afterAllDeleted = await getFirstChapterCreatedAt();

    expect(beforeAnyChapter).toBeNull();
    expect(afterTwoChapters).toBe(first.createdAt);
    expect(afterFirstDeleted).toBe(second.createdAt);
    expect(afterAllDeleted).toBeNull();
  });

  it('should not change when a later chapter is deleted', async () => {
    const first = await createChapter('Departure');
    const second = await createChapter('The Dry Sea');

    await graphql(DELETE_CHAPTER, { id: second.id }, writer);
    const result = await getFirstChapterCreatedAt();

    expect(result).toBe(first.createdAt);

    await graphql(DELETE_CHAPTER, { id: first.id }, writer);
  });
});

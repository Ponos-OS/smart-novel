import axios from 'axios';
import { randomUUID } from 'node:crypto';

import { AuthorizationFixture, ClusterFixture } from '../../support';

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

  return data;
}

function count(table: string, where: string): number {
  return Number(
    ClusterFixture.queryDatabase(
      `SELECT count(*) FROM ${table} WHERE ${where};`,
    ),
  );
}

describe('Novel deletion (e2e)', () => {
  async function createNovelWithChapters(chapterCount: number) {
    const writer =
      await AuthorizationFixture.getWriterAuthorizationHeader();
    const created = await graphql(
      `
        #graphql
        mutation CreateNovel($input: CreateNovelInput!) {
          createNovel(input: $input) {
            id
          }
        }
      `,
      {
        input: {
          name: 'The Lantern Keeper',
          description: 'A lighthouse keeper finds a door in the fog.',
          categories: [`e2e-delete-${randomUUID().slice(0, 8)}`],
        },
      },
      writer,
    );
    const novelId: string = created.data.createNovel.id;
    const chapterIds: string[] = [];

    for (let index = 1; index <= chapterCount; index++) {
      const chapter = await graphql(
        `
          #graphql
          mutation CreateChapter(
            $novelId: ID!
            $input: CreateChapterInput!
          ) {
            createChapter(novelId: $novelId, input: $input) {
              id
            }
          }
        `,
        {
          novelId,
          input: {
            title: `Chapter ${index}`,
            content: `# Chapter ${index}\n\nSome content.`,
          },
        },
        writer,
      );
      chapterIds.push(chapter.data.createChapter.id);
    }

    return { novelId, chapterIds };
  }

  function deleteNovel(novelId: string, authorization: string) {
    return graphql(
      `
        #graphql
        mutation DeleteNovel($id: ID!) {
          deleteNovel(id: $id) {
            id
          }
        }
      `,
      { id: novelId },
      authorization,
    );
  }

  it.each([
    {
      role: 'owner',
      getAuthorizationHeader:
        AuthorizationFixture.getWriterAuthorizationHeader,
    },
    {
      role: 'admin',
      getAuthorizationHeader:
        AuthorizationFixture.getAdminAuthorizationHeader,
    },
  ])(
    'should allow the $role to delete a novel',
    async ({ getAuthorizationHeader }) => {
      const { novelId } = await createNovelWithChapters(1);
      const authorization = await getAuthorizationHeader();

      const data = await deleteNovel(novelId, authorization);

      expect(data.errors).toBeUndefined();
      expect(data.data.deleteNovel).toStrictEqual({ id: novelId });
      expect(count('novels', `id = '${novelId}'`)).toBe(0);
    },
  );

  it.each([
    {
      role: 'user',
      getAuthorizationHeader:
        AuthorizationFixture.getUserAuthorizationHeader,
    },
    {
      role: 'writer who does not own the novel',
      getAuthorizationHeader:
        AuthorizationFixture.getSecondWriterAuthorizationHeader,
    },
  ])(
    'should NOT allow $role to delete a novel',
    async ({ getAuthorizationHeader }) => {
      const { novelId } = await createNovelWithChapters(1);
      const authorization = await getAuthorizationHeader();

      const data = await deleteNovel(novelId, authorization);

      expect(data.errors[0].message).toContain(
        'You do not have permission to delete this novel',
      );
      expect(count('novels', `id = '${novelId}'`)).toBe(1);
    },
  );

  it('should return a not-found error for an unknown novel id', async () => {
    const admin =
      await AuthorizationFixture.getAdminAuthorizationHeader();

    const data = await deleteNovel(randomUUID(), admin);

    expect(data.errors[0].message).toContain('not found');
  });

  it('should remove the chapters, their contents, read history and category links, and leave other novels untouched', async () => {
    const doomed = await createNovelWithChapters(2);
    const survivor = await createNovelWithChapters(1);
    const writer =
      await AuthorizationFixture.getWriterAuthorizationHeader();
    for (const { chapterIds } of [doomed, survivor]) {
      await graphql(
        `
          #graphql
          mutation MarkChaptersRead($chapterIds: [ID!]!) {
            markChaptersRead(chapterIds: $chapterIds) {
              markedCount
            }
          }
        `,
        { chapterIds },
        writer,
      );
    }
    const doomedContentIds = ClusterFixture.queryDatabase(
      `SELECT content_id FROM chapters WHERE novel_id = '${doomed.novelId}';`,
    )
      .split('\n')
      .map((id) => `'${id}'`)
      .join(',');
    expect(
      count('chapter_user_states', `novel_id = '${doomed.novelId}'`),
    ).toBe(2);
    expect(
      count('novel_categories', `novel_id = '${doomed.novelId}'`),
    ).toBe(1);

    const data = await deleteNovel(doomed.novelId, writer);

    expect(data.errors).toBeUndefined();
    expect(count('chapters', `novel_id = '${doomed.novelId}'`)).toBe(
      0,
    );
    expect(
      count('chapter_contents', `id IN (${doomedContentIds})`),
    ).toBe(0);
    expect(
      count('chapter_user_states', `novel_id = '${doomed.novelId}'`),
    ).toBe(0);
    expect(
      count('novel_categories', `novel_id = '${doomed.novelId}'`),
    ).toBe(0);
    expect(count('novels', `id = '${survivor.novelId}'`)).toBe(1);
    expect(
      count('chapters', `novel_id = '${survivor.novelId}'`),
    ).toBe(1);
    expect(
      count(
        'chapter_user_states',
        `novel_id = '${survivor.novelId}'`,
      ),
    ).toBe(1);
    expect(
      count('novel_categories', `novel_id = '${survivor.novelId}'`),
    ).toBe(1);

    await deleteNovel(survivor.novelId, writer);
  });
});

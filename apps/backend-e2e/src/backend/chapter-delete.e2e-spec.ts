import axios from 'axios';
import { randomUUID } from 'node:crypto';

import { AuthorizationFixture } from '../support';

describe('Chapter deletion (e2e)', () => {
  const NOVEL_ID = 'c1d31ec2-f478-4648-b90b-d1e53de2a829'; // example-novel from seed data, owned by the writer

  async function graphql(
    query: string,
    variables: Record<string, unknown>,
    authorizationHeader: string,
  ) {
    const { data } = await axios.post(
      '/graphql',
      { query, variables },
      { headers: { Authorization: authorizationHeader } },
    );

    return data;
  }

  async function createChapter(
    title: string,
    authorizationHeader: string,
  ): Promise<{ id: string; chapterNumber: number }> {
    const data = await graphql(
      `
        #graphql
        mutation CreateChapter(
          $novelId: ID!
          $input: CreateChapterInput!
        ) {
          createChapter(novelId: $novelId, input: $input) {
            id
            chapterNumber
          }
        }
      `,
      {
        novelId: NOVEL_ID,
        input: { title, content: `# ${title}\n\nSome content.` },
      },
      authorizationHeader,
    );

    return data.data.createChapter;
  }

  async function getChapter(
    chapterId: string,
    authorizationHeader: string,
  ): Promise<{
    chapterNumber: number;
    previous: { id: string } | null;
    next: { id: string } | null;
  } | null> {
    const data = await graphql(
      `
        #graphql
        query GetChapter($novelId: ID!, $chapterId: ID!) {
          novel(id: $novelId) {
            chapter(id: $chapterId) {
              chapterNumber
              previous {
                id
              }
              next {
                id
              }
            }
          }
        }
      `,
      { novelId: NOVEL_ID, chapterId },
      authorizationHeader,
    );

    return data.data.novel.chapter;
  }

  function deleteChapter(
    chapterId: string,
    authorizationHeader: string,
  ) {
    return graphql(
      `
        #graphql
        mutation DeleteChapter($id: ID!) {
          deleteChapter(id: $id) {
            id
            novelId
          }
        }
      `,
      { id: chapterId },
      authorizationHeader,
    );
  }

  it.each([
    {
      role: 'admin',
      getAuthorizationHeader:
        AuthorizationFixture.getAdminAuthorizationHeader,
    },
    {
      role: 'writer who owns the novel',
      getAuthorizationHeader:
        AuthorizationFixture.getWriterAuthorizationHeader,
    },
  ])(
    'should allow $role to delete a chapter',
    async ({ role, getAuthorizationHeader }) => {
      const writerHeader =
        await AuthorizationFixture.getWriterAuthorizationHeader();
      const authorizationHeader = await getAuthorizationHeader();
      const chapter = await createChapter(
        `Chapter deleted by ${role}`,
        writerHeader,
      );

      const data = await deleteChapter(
        chapter.id,
        authorizationHeader,
      );

      expect(data.errors).toBeUndefined();
      expect(data.data.deleteChapter).toStrictEqual({
        id: chapter.id,
        novelId: NOVEL_ID,
      });
      expect(await getChapter(chapter.id, writerHeader)).toBeNull();
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
    'should NOT allow $role to delete a chapter',
    async ({ getAuthorizationHeader }) => {
      const writerHeader =
        await AuthorizationFixture.getWriterAuthorizationHeader();
      const chapter = await createChapter(
        'Chapter that must survive',
        writerHeader,
      );
      const authorizationHeader = await getAuthorizationHeader();

      const data = await deleteChapter(
        chapter.id,
        authorizationHeader,
      );

      expect(data.errors[0].message).toContain(
        'You do not have permission to delete this chapter',
      );
      expect(
        await getChapter(chapter.id, writerHeader),
      ).not.toBeNull();

      await deleteChapter(chapter.id, writerHeader);
    },
  );

  it('should return a not-found error for an unknown chapter id', async () => {
    const adminHeader =
      await AuthorizationFixture.getAdminAuthorizationHeader();

    const data = await deleteChapter(randomUUID(), adminHeader);

    expect(data.errors[0].message).toContain('not found');
  });

  it('should renumber only the later chapters and keep navigation and the next chapter number correct', async () => {
    const writerHeader =
      await AuthorizationFixture.getWriterAuthorizationHeader();
    const first = await createChapter('To be deleted', writerHeader);
    const second = await createChapter('Second', writerHeader);
    const third = await createChapter('Third', writerHeader);

    await deleteChapter(first.id, writerHeader);

    const secondAfter = await getChapter(second.id, writerHeader);
    const thirdAfter = await getChapter(third.id, writerHeader);
    expect(secondAfter!.chapterNumber).toBe(second.chapterNumber - 1);
    expect(thirdAfter!.chapterNumber).toBe(third.chapterNumber - 1);
    expect(secondAfter!.next).toStrictEqual({ id: third.id });
    expect(thirdAfter!.previous).toStrictEqual({ id: second.id });

    const fourth = await createChapter('Fourth', writerHeader);
    expect(fourth.chapterNumber).toBe(thirdAfter!.chapterNumber + 1);

    await Promise.all(
      [second, third, fourth].map(({ id }) =>
        deleteChapter(id, writerHeader),
      ),
    );
  });

  it('should not change any other chapter when the last chapter is deleted', async () => {
    const writerHeader =
      await AuthorizationFixture.getWriterAuthorizationHeader();
    const earlier = await createChapter('Earlier', writerHeader);
    const last = await createChapter('Last', writerHeader);

    await deleteChapter(last.id, writerHeader);

    const earlierAfter = await getChapter(earlier.id, writerHeader);
    expect(earlierAfter!.chapterNumber).toBe(earlier.chapterNumber);
    expect(earlierAfter!.next).toBeNull();

    await deleteChapter(earlier.id, writerHeader);
  });

  it('should end with consecutive numbers when two chapters of the same novel are deleted concurrently', async () => {
    const writerHeader =
      await AuthorizationFixture.getWriterAuthorizationHeader();
    const first = await createChapter('Concurrent 1', writerHeader);
    const second = await createChapter('Concurrent 2', writerHeader);
    const third = await createChapter('Concurrent 3', writerHeader);
    const fourth = await createChapter('Concurrent 4', writerHeader);

    const results = await Promise.all([
      deleteChapter(first.id, writerHeader),
      deleteChapter(second.id, writerHeader),
    ]);

    expect(results.map(({ errors }) => errors)).toStrictEqual([
      undefined,
      undefined,
    ]);
    const thirdAfter = await getChapter(third.id, writerHeader);
    const fourthAfter = await getChapter(fourth.id, writerHeader);
    expect(thirdAfter!.chapterNumber).toBe(third.chapterNumber - 2);
    expect(fourthAfter!.chapterNumber).toBe(
      thirdAfter!.chapterNumber + 1,
    );

    await Promise.all(
      [third, fourth].map(({ id }) =>
        deleteChapter(id, writerHeader),
      ),
    );
  });

  it('should delete the chapter together with its read history', async () => {
    const writerHeader =
      await AuthorizationFixture.getWriterAuthorizationHeader();
    const chapter = await createChapter(
      'Read then deleted',
      writerHeader,
    );
    await graphql(
      `
        #graphql
        mutation MarkChaptersRead($chapterIds: [ID!]!) {
          markChaptersRead(chapterIds: $chapterIds) {
            markedCount
          }
        }
      `,
      { chapterIds: [chapter.id] },
      writerHeader,
    );

    const data = await deleteChapter(chapter.id, writerHeader);

    expect(data.errors).toBeUndefined();
    expect(await getChapter(chapter.id, writerHeader)).toBeNull();
  });
});

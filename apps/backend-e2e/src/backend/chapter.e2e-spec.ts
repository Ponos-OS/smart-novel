import axios from 'axios';

import { AuthorizationFixture } from '../support';

describe('Chapter (e2e)', () => {
  const NOVEL_ID = 'c1d31ec2-f478-4648-b90b-d1e53de2a829'; // example-novel from seed data
  const CHAPTER_ONE_ID = '4dd92f16-4743-47b9-960c-6529678e9bc5'; // chapter1 from seed data
  const CHAPTER_FIVE_ID = '6d908673-b125-4729-9da9-4fb907afe2a1'; // chapter5 from seed data

  async function getContentUpdatedAt(
    chapterId: string,
    authorizationHeader: string,
  ): Promise<string> {
    const { data } = await axios.post(
      '/graphql',
      {
        query: `#graphql
          query GetChapterContentUpdatedAt($novelId: ID!, $chapterId: ID!) {
            novel(id: $novelId) {
              chapter(id: $chapterId) {
                contentUpdatedAt
              }
            }
          }
        `,
        variables: { novelId: NOVEL_ID, chapterId },
      },
      { headers: { Authorization: authorizationHeader } },
    );

    return data.data.novel.chapter.contentUpdatedAt;
  }

  async function getUpdatedAt(
    chapterId: string,
    authorizationHeader: string,
  ): Promise<string> {
    const { data } = await axios.post(
      '/graphql',
      {
        query: `#graphql
          query GetChapterUpdatedAt($novelId: ID!, $chapterId: ID!) {
            novel(id: $novelId) {
              chapter(id: $chapterId) {
                updatedAt
              }
            }
          }
        `,
        variables: { novelId: NOVEL_ID, chapterId },
      },
      { headers: { Authorization: authorizationHeader } },
    );

    return data.data.novel.chapter.updatedAt;
  }

  it('should return the selected chapter', async () => {
    const res = await axios.post('/graphql', {
      query: `#graphql
        query GetChapter($novelId: ID!, $chapterId: ID!) {
          novel(id: $novelId) {
            chapter(id: $chapterId) {
              id
              title
              content
              createdAt
              updatedAt
            }
          }
        }
      `,
      variables: {
        novelId: NOVEL_ID,
        chapterId: CHAPTER_ONE_ID,
      },
    });

    expect(res.data.data.novel.chapter).toStrictEqual(
      expect.objectContaining({
        id: CHAPTER_ONE_ID,
        title: 'The Beginning',
        content:
          "# Chapter 1: The Beginning\n\nIn a small village nestled between rolling hills and ancient forests, a young adventurer named Elena discovered an old map hidden in her grandmother's attic. The map was yellowed with age, its edges frayed, but the intricate markings and mysterious symbols captured her imagination immediately.\n\nShe scrutinized the men's faces carefully, trying to work out who was lying about the treasure's location. The village elders had always spoken of a legendary artifact, but none had dared to seek it.\n\nAs dawn broke over the horizon, Elena made her decision. She would embark on this journey, following the map's cryptic directions into the unknown. Little did she know that this choice would change her life forever.\n\nThe path ahead was uncertain, filled with both danger and wonder. But Elena was ready. Her adventure was just beginning.",
      }),
    );
    expect(res.data.data.novel.chapter.createdAt).toBeDateString();
    expect(res.data.data.novel.chapter.updatedAt).toBeDateString();
  });

  it('should return next chapter', async () => {
    const res = await axios.post('/graphql', {
      query: `#graphql
        query GetChapter($novelId: ID!, $chapterId: ID!) {
          novel(id: $novelId) {
            chapter(id: $chapterId) {
              next {
                id
              }
            }
          }
        }
      `,
      variables: {
        novelId: NOVEL_ID,
        chapterId: CHAPTER_ONE_ID,
      },
    });

    expect(res.data.data.novel.chapter.next.id).toBe(
      '4769a024-6267-4abc-a412-5ab0241a8d0e',
    );
  });

  it('should return previous chapter', async () => {
    const res = await axios.post('/graphql', {
      query: `#graphql
        query GetChapter($novelId: ID!, $chapterId: ID!) {
          novel(id: $novelId) {
            chapter(id: $chapterId) {
              previous {
                id
                }
              }
            }
          }
        `,
      variables: {
        novelId: NOVEL_ID,
        chapterId: '4769a024-6267-4abc-a412-5ab0241a8d0e',
      },
    });

    expect(res.data.data.novel.chapter.previous.id).toBe(
      CHAPTER_ONE_ID,
    );
  });

  it.each([
    {
      role: 'admin',
      getAuthorizationHeader:
        AuthorizationFixture.getAdminAuthorizationHeader,
    },
    {
      role: 'writer',
      getAuthorizationHeader:
        AuthorizationFixture.getWriterAuthorizationHeader,
    },
  ])(
    'should ONLY allow $role to create a chapter',
    async ({ role, getAuthorizationHeader }) => {
      const authorizationHeader = await getAuthorizationHeader();

      const { status, data } = await axios.post(
        '/graphql',
        {
          query: `#graphql
            mutation CreateChapter($novelId: ID!, $input: CreateChapterInput!) {
              createChapter(novelId: $novelId, input: $input) {
                id
                novelId
                title
                chapterNumber
              }
            }
          `,
          variables: {
            novelId: NOVEL_ID,
            input: {
              title: `Chapter created by ${role}`,
              content: '# New Chapter\n\nSome content.',
            },
          },
        },
        { headers: { Authorization: authorizationHeader } },
      );

      expect(status).toBe(200);
      expect(data.errors).toBeUndefined();
      expect(data.data.createChapter).toStrictEqual(
        expect.objectContaining({
          novelId: NOVEL_ID,
          title: `Chapter created by ${role}`,
          chapterNumber: expect.any(Number),
        }),
      );
    },
  );

  it.each([
    {
      role: 'user',
      getAuthorizationHeader:
        AuthorizationFixture.getUserAuthorizationHeader,
      // Rejected by the coarse @CheckPolicy('chapter', 'create') role gate.
      expectedMessage:
        'You do not have permission to create this chapter',
    },
    {
      role: 'writer who does not own the novel',
      getAuthorizationHeader:
        AuthorizationFixture.getSecondWriterAuthorizationHeader,
      // Rejected by ChapterPolicy.assertCanCreateInNovel's explicit ownership check.
      expectedMessage:
        'You do not have permission to create a chapter in this novel',
    },
  ])(
    'should NOT allow $role to create a chapter',
    async ({ getAuthorizationHeader, expectedMessage }) => {
      const authorizationHeader = await getAuthorizationHeader();

      const { status, data } = await axios.post(
        '/graphql',
        {
          query: `#graphql
            mutation CreateChapter($novelId: ID!, $input: CreateChapterInput!) {
              createChapter(novelId: $novelId, input: $input) {
                id
              }
            }
          `,
          variables: {
            novelId: NOVEL_ID,
            input: {
              title: 'Should not be created',
              content: '# Should not be created',
            },
          },
        },
        { headers: { Authorization: authorizationHeader } },
      );

      expect(status).toBe(200);
      expect(data.errors).toBeArray();
      expect(data.errors[0].message).toContain(expectedMessage);
    },
  );

  it.each([
    {
      role: 'admin',
      getAuthorizationHeader:
        AuthorizationFixture.getAdminAuthorizationHeader,
    },
    {
      role: 'writer',
      getAuthorizationHeader:
        AuthorizationFixture.getWriterAuthorizationHeader,
    },
  ])(
    'should ONLY allow $role to update content',
    async ({ getAuthorizationHeader }) => {
      const authorizationHeader = await getAuthorizationHeader();
      const expectedContentUpdatedAt = await getContentUpdatedAt(
        CHAPTER_FIVE_ID,
        authorizationHeader,
      );

      const { status, data } = await axios.post(
        '/graphql',
        {
          query: `#graphql
            mutation UpdateContent($id: ID!, $content: String!, $expectedContentUpdatedAt: String!) {
              updateContent(id: $id, content: $content, expectedContentUpdatedAt: $expectedContentUpdatedAt) {
                id
                content
                updatedAt
              }
            }
          `,
          variables: {
            id: CHAPTER_FIVE_ID,
            content: '# Chapter 5\n\nUpdated content',
            expectedContentUpdatedAt,
          },
        },
        { headers: { Authorization: authorizationHeader } },
      );

      expect(status).toBe(200);
      expect(data.errors).toBeUndefined();
      expect(data.data.updateContent).toStrictEqual(
        expect.objectContaining({
          id: CHAPTER_FIVE_ID,
          content: '# Chapter 5\n\nUpdated content',
        }),
      );
      expect(data.data.updateContent.updatedAt).toBeDateString();
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
    'should NOT allow unauthorized errors when $role tries to update content',
    async ({ getAuthorizationHeader }) => {
      const authorizationHeader = await getAuthorizationHeader();
      const expectedContentUpdatedAt = await getContentUpdatedAt(
        CHAPTER_FIVE_ID,
        authorizationHeader,
      );

      const { status, data } = await axios.post(
        '/graphql',
        {
          query: `#graphql
          mutation UpdateContent($id: ID!, $content: String!, $expectedContentUpdatedAt: String!) {
            updateContent(id: $id, content: $content, expectedContentUpdatedAt: $expectedContentUpdatedAt) {
              id
              content
              updatedAt
            }
          }
        `,
          variables: {
            id: CHAPTER_FIVE_ID,
            content: '# Chapter 5\n\nUpdated content',
            expectedContentUpdatedAt,
          },
        },
        { headers: { Authorization: authorizationHeader } },
      );

      expect(status).toBe(200);
      expect(data.errors).toBeArray();
      expect(data.errors[0].message).toContain(
        'You do not have permission to update this chapter',
      );
    },
  );

  it.each([
    {
      role: 'admin',
      getAuthorizationHeader:
        AuthorizationFixture.getAdminAuthorizationHeader,
    },
    {
      role: 'writer',
      getAuthorizationHeader:
        AuthorizationFixture.getWriterAuthorizationHeader,
    },
  ])(
    'should ONLY allow $role to update chapter metadata',
    async ({ getAuthorizationHeader }) => {
      const authorizationHeader = await getAuthorizationHeader();
      const expectedUpdatedAt = await getUpdatedAt(
        CHAPTER_FIVE_ID,
        authorizationHeader,
      );

      const { status, data } = await axios.post(
        '/graphql',
        {
          query: `#graphql
            mutation UpdateChapter($id: ID!, $input: UpdateChapterInput!, $expectedUpdatedAt: String!) {
              updateChapter(id: $id, input: $input, expectedUpdatedAt: $expectedUpdatedAt) {
                id
                title
                updatedAt
              }
            }
          `,
          variables: {
            id: CHAPTER_FIVE_ID,
            input: { title: 'Updated Chapter 5 Title' },
            expectedUpdatedAt,
          },
        },
        { headers: { Authorization: authorizationHeader } },
      );

      expect(status).toBe(200);
      expect(data.errors).toBeUndefined();
      expect(data.data.updateChapter).toStrictEqual(
        expect.objectContaining({
          id: CHAPTER_FIVE_ID,
          title: 'Updated Chapter 5 Title',
        }),
      );
      expect(data.data.updateChapter.updatedAt).toBeDateString();
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
    'should NOT allow unauthorized errors when $role tries to update chapter metadata',
    async ({ getAuthorizationHeader }) => {
      const authorizationHeader = await getAuthorizationHeader();
      const expectedUpdatedAt = await getUpdatedAt(
        CHAPTER_FIVE_ID,
        authorizationHeader,
      );

      const { status, data } = await axios.post(
        '/graphql',
        {
          query: `#graphql
            mutation UpdateChapter($id: ID!, $input: UpdateChapterInput!, $expectedUpdatedAt: String!) {
              updateChapter(id: $id, input: $input, expectedUpdatedAt: $expectedUpdatedAt) {
                id
                title
                updatedAt
              }
            }
          `,
          variables: {
            id: CHAPTER_FIVE_ID,
            input: { title: 'Updated Chapter 5 Title' },
            expectedUpdatedAt,
          },
        },
        { headers: { Authorization: authorizationHeader } },
      );

      expect(status).toBe(200);
      expect(data.errors).toBeArray();
      expect(data.errors[0].message).toContain(
        'You do not have permission to update this chapter',
      );
    },
  );

  it('should leave content and narrationStatus unchanged after a title-only update', async () => {
    const authorizationHeader =
      await AuthorizationFixture.getWriterAuthorizationHeader();
    const beforeRes = await axios.post(
      '/graphql',
      {
        query: `#graphql
          query GetChapter($novelId: ID!, $chapterId: ID!) {
            novel(id: $novelId) {
              chapter(id: $chapterId) {
                content
                narrationStatus
              }
            }
          }
        `,
        variables: { novelId: NOVEL_ID, chapterId: CHAPTER_FIVE_ID },
      },
      { headers: { Authorization: authorizationHeader } },
    );
    const { content, narrationStatus } =
      beforeRes.data.data.novel.chapter;
    const expectedUpdatedAt = await getUpdatedAt(
      CHAPTER_FIVE_ID,
      authorizationHeader,
    );

    const { data } = await axios.post(
      '/graphql',
      {
        query: `#graphql
          mutation UpdateChapter($id: ID!, $input: UpdateChapterInput!, $expectedUpdatedAt: String!) {
            updateChapter(id: $id, input: $input, expectedUpdatedAt: $expectedUpdatedAt) {
              id
              title
            }
          }
        `,
        variables: {
          id: CHAPTER_FIVE_ID,
          input: { title: 'Title-Only Update' },
          expectedUpdatedAt,
        },
      },
      { headers: { Authorization: authorizationHeader } },
    );

    expect(data.errors).toBeUndefined();
    expect(data.data.updateChapter.title).toBe('Title-Only Update');

    const afterRes = await axios.post(
      '/graphql',
      {
        query: `#graphql
          query GetChapter($novelId: ID!, $chapterId: ID!) {
            novel(id: $novelId) {
              chapter(id: $chapterId) {
                content
                narrationStatus
              }
            }
          }
        `,
        variables: { novelId: NOVEL_ID, chapterId: CHAPTER_FIVE_ID },
      },
      { headers: { Authorization: authorizationHeader } },
    );

    expect(afterRes.data.data.novel.chapter).toStrictEqual({
      content,
      narrationStatus,
    });
  });

  it('should reject a second content save that reuses a now-stale expectedContentUpdatedAt, keeping only the first save', async () => {
    const authorizationHeader =
      await AuthorizationFixture.getWriterAuthorizationHeader();
    const originalContentUpdatedAt = await getContentUpdatedAt(
      CHAPTER_FIVE_ID,
      authorizationHeader,
    );
    const mutation = `#graphql
      mutation UpdateContent($id: ID!, $content: String!, $expectedContentUpdatedAt: String!) {
        updateContent(id: $id, content: $content, expectedContentUpdatedAt: $expectedContentUpdatedAt) {
          content
        }
      }
    `;

    const firstSave = await axios.post(
      '/graphql',
      {
        query: mutation,
        variables: {
          id: CHAPTER_FIVE_ID,
          content: '# Chapter 5\n\nFirst concurrent save',
          expectedContentUpdatedAt: originalContentUpdatedAt,
        },
      },
      { headers: { Authorization: authorizationHeader } },
    );

    expect(firstSave.data.errors).toBeUndefined();
    expect(firstSave.data.data.updateContent.content).toBe(
      '# Chapter 5\n\nFirst concurrent save',
    );

    const secondSave = await axios.post(
      '/graphql',
      {
        query: mutation,
        variables: {
          id: CHAPTER_FIVE_ID,
          content:
            '# Chapter 5\n\nSecond concurrent save, should be rejected',
          expectedContentUpdatedAt: originalContentUpdatedAt,
        },
      },
      { headers: { Authorization: authorizationHeader } },
    );

    expect(secondSave.data.errors).toBeArray();
    expect(secondSave.data.errors[0].message).toContain(
      'updated by someone else',
    );

    const { data } = await axios.post('/graphql', {
      query: `#graphql
        query GetChapter($novelId: ID!, $chapterId: ID!) {
          novel(id: $novelId) {
            chapter(id: $chapterId) {
              content
            }
          }
        }
      `,
      variables: { novelId: NOVEL_ID, chapterId: CHAPTER_FIVE_ID },
    });

    expect(data.data.novel.chapter.content).toBe(
      '# Chapter 5\n\nFirst concurrent save',
    );
  });

  it('should reject a second title save that reuses a now-stale expectedUpdatedAt, keeping only the first save', async () => {
    const authorizationHeader =
      await AuthorizationFixture.getWriterAuthorizationHeader();
    const originalUpdatedAt = await getUpdatedAt(
      CHAPTER_FIVE_ID,
      authorizationHeader,
    );
    const mutation = `#graphql
      mutation UpdateChapter($id: ID!, $input: UpdateChapterInput!, $expectedUpdatedAt: String!) {
        updateChapter(id: $id, input: $input, expectedUpdatedAt: $expectedUpdatedAt) {
          title
        }
      }
    `;

    const firstSave = await axios.post(
      '/graphql',
      {
        query: mutation,
        variables: {
          id: CHAPTER_FIVE_ID,
          input: { title: 'First concurrent title save' },
          expectedUpdatedAt: originalUpdatedAt,
        },
      },
      { headers: { Authorization: authorizationHeader } },
    );

    expect(firstSave.data.errors).toBeUndefined();
    expect(firstSave.data.data.updateChapter.title).toBe(
      'First concurrent title save',
    );

    const secondSave = await axios.post(
      '/graphql',
      {
        query: mutation,
        variables: {
          id: CHAPTER_FIVE_ID,
          input: {
            title: 'Second concurrent title save, should be rejected',
          },
          expectedUpdatedAt: originalUpdatedAt,
        },
      },
      { headers: { Authorization: authorizationHeader } },
    );

    expect(secondSave.data.errors).toBeArray();
    expect(secondSave.data.errors[0].message).toContain(
      'updated by someone else',
    );

    const { data } = await axios.post('/graphql', {
      query: `#graphql
        query GetChapter($novelId: ID!, $chapterId: ID!) {
          novel(id: $novelId) {
            chapter(id: $chapterId) {
              title
            }
          }
        }
      `,
      variables: { novelId: NOVEL_ID, chapterId: CHAPTER_FIVE_ID },
    });

    expect(data.data.novel.chapter.title).toBe(
      'First concurrent title save',
    );
  });

  it('should succeed saving a title using an expectedUpdatedAt captured before an unrelated content-only change (independent version tokens)', async () => {
    const authorizationHeader =
      await AuthorizationFixture.getWriterAuthorizationHeader();
    const expectedUpdatedAt = await getUpdatedAt(
      CHAPTER_FIVE_ID,
      authorizationHeader,
    );
    const expectedContentUpdatedAt = await getContentUpdatedAt(
      CHAPTER_FIVE_ID,
      authorizationHeader,
    );

    const contentSave = await axios.post(
      '/graphql',
      {
        query: `#graphql
          mutation UpdateContent($id: ID!, $content: String!, $expectedContentUpdatedAt: String!) {
            updateContent(id: $id, content: $content, expectedContentUpdatedAt: $expectedContentUpdatedAt) {
              content
            }
          }
        `,
        variables: {
          id: CHAPTER_FIVE_ID,
          content: '# Chapter 5\n\nContent changed before title save',
          expectedContentUpdatedAt,
        },
      },
      { headers: { Authorization: authorizationHeader } },
    );

    expect(contentSave.data.errors).toBeUndefined();

    const titleSave = await axios.post(
      '/graphql',
      {
        query: `#graphql
          mutation UpdateChapter($id: ID!, $input: UpdateChapterInput!, $expectedUpdatedAt: String!) {
            updateChapter(id: $id, input: $input, expectedUpdatedAt: $expectedUpdatedAt) {
              title
            }
          }
        `,
        variables: {
          id: CHAPTER_FIVE_ID,
          input: {
            title: 'Title saved after unrelated content change',
          },
          expectedUpdatedAt,
        },
      },
      { headers: { Authorization: authorizationHeader } },
    );

    expect(titleSave.data.errors).toBeUndefined();
    expect(titleSave.data.data.updateChapter.title).toBe(
      'Title saved after unrelated content change',
    );
  });
});

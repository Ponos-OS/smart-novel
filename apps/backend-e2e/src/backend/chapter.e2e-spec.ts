import axios from 'axios';

import { AuthorizationFixture } from '../support';

describe('Chapter (e2e)', () => {
  const NOVEL_ID = 'c1d31ec2-f478-4648-b90b-d1e53de2a829'; // example-novel from seed data
  const CHAPTER_ONE_ID = '4dd92f16-4743-47b9-960c-6529678e9bc5'; // chapter1 from seed data
  // Dedicated to the content-mutating tests below — updateContent also triggers a real
  // Beatrice generateAudio call as a side effect, so mutating CHAPTER_ONE_ID here used to
  // race chapter-narration.e2e-spec.ts's own generateChapterAudio tests on that same chapter.
  const CHAPTER_FIVE_ID = '6d908673-b125-4729-9da9-4fb907afe2a1'; // chapter5 from seed data

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
    'should ONLY allow $role to update content',
    async ({ getAuthorizationHeader }) => {
      const authorizationHeader = await getAuthorizationHeader();

      const { status, data } = await axios.post(
        '/graphql',
        {
          query: `#graphql
            mutation UpdateContent($id: ID!, $content: String!) {
              updateContent(id: $id, content: $content) {
                id
                content
                updatedAt
              }
            }
          `,
          variables: {
            id: CHAPTER_FIVE_ID,
            content: '# Chapter 5\n\nUpdated content',
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

      const { status, data } = await axios.post(
        '/graphql',
        {
          query: `#graphql
          mutation UpdateContent($id: ID!, $content: String!) {
            updateContent(id: $id, content: $content) {
              id
              content
              updatedAt
            }
          }
        `,
          variables: {
            id: CHAPTER_FIVE_ID,
            content: '# Chapter 5\n\nUpdated content',
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

      const { status, data } = await axios.post(
        '/graphql',
        {
          query: `#graphql
            mutation UpdateChapter($id: ID!, $input: UpdateChapterInput!) {
              updateChapter(id: $id, input: $input) {
                id
                title
                updatedAt
              }
            }
          `,
          variables: {
            id: CHAPTER_FIVE_ID,
            input: { title: 'Updated Chapter 5 Title' },
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

      const { status, data } = await axios.post(
        '/graphql',
        {
          query: `#graphql
            mutation UpdateChapter($id: ID!, $input: UpdateChapterInput!) {
              updateChapter(id: $id, input: $input) {
                id
                title
                updatedAt
              }
            }
          `,
          variables: {
            id: CHAPTER_FIVE_ID,
            input: { title: 'Updated Chapter 5 Title' },
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

    const { data } = await axios.post(
      '/graphql',
      {
        query: `#graphql
          mutation UpdateChapter($id: ID!, $input: UpdateChapterInput!) {
            updateChapter(id: $id, input: $input) {
              id
              title
            }
          }
        `,
        variables: {
          id: CHAPTER_FIVE_ID,
          input: { title: 'Title-Only Update' },
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
});

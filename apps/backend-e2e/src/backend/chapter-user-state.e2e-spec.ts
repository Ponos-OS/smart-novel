import axios from 'axios';

import { AuthorizationFixture, NovelFixture } from '../support';

describe('ChapterUserState (e2e)', () => {
  let NOVEL_ID: string;
  let CHAPTER_ONE_ID: string;
  let CHAPTER_TWO_ID: string;
  let CHAPTER_THREE_ID: string;
  let CHAPTER_FOUR_ID: string;

  beforeAll(async () => {
    const { novelId, chapterIds } = await NovelFixture.create({
      chapters: 4,
    });
    NOVEL_ID = novelId;
    [
      CHAPTER_ONE_ID,
      CHAPTER_TWO_ID,
      CHAPTER_THREE_ID,
      CHAPTER_FOUR_ID,
    ] = chapterIds;
  });

  describe('viewerState field resolver', () => {
    it('should return isRead: false for unauthenticated users', async () => {
      const res = await axios.post('/graphql', {
        query: `#graphql
          query GetChapterViewerState($novelId: ID!, $chapterId: ID!) {
            novel(id: $novelId) {
              chapter(id: $chapterId) {
                viewerState {
                  isRead
                  readAt
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

      expect(res.status).toBe(200);
      expect(res.data.data.novel.chapter.viewerState).toStrictEqual({
        isRead: false,
        readAt: null,
      });
    });

    it('should return isRead: false for authenticated user with unread chapter', async () => {
      const authorizationHeader =
        await AuthorizationFixture.getUserAuthorizationHeader();

      const res = await axios.post(
        '/graphql',
        {
          query: `#graphql
            query GetChapterViewerState($novelId: ID!, $chapterId: ID!) {
              novel(id: $novelId) {
                chapter(id: $chapterId) {
                  viewerState {
                    isRead
                    readAt
                  }
                }
              }
            }
          `,
          variables: {
            novelId: NOVEL_ID,
            chapterId: CHAPTER_ONE_ID,
          },
        },
        { headers: { Authorization: authorizationHeader } },
      );

      expect(res.status).toBe(200);
      expect(res.data.data.novel.chapter.viewerState).toStrictEqual({
        isRead: false,
        readAt: null,
      });
    });

    it('should return isRead: true after marking chapter as read', async () => {
      const authorizationHeader =
        await AuthorizationFixture.getUserAuthorizationHeader();
      await axios.post(
        '/graphql',
        {
          query: `#graphql
            mutation MarkChaptersRead($chapterIds: [ID!]!) {
              markChaptersRead(chapterIDs: $chapterIds) {
                markedCount
              }
            }
          `,
          variables: {
            chapterIds: [CHAPTER_ONE_ID],
          },
        },
        { headers: { Authorization: authorizationHeader } },
      );

      const res = await axios.post(
        '/graphql',
        {
          query: `#graphql
            query GetChapterViewerState($novelId: ID!, $chapterId: ID!) {
              novel(id: $novelId) {
                chapter(id: $chapterId) {
                  id
                  viewerState {
                    isRead
                    readAt
                  }
                }
              }
            }
          `,
          variables: {
            novelId: NOVEL_ID,
            chapterId: CHAPTER_ONE_ID,
          },
        },
        { headers: { Authorization: authorizationHeader } },
      );

      expect(res.status).toBe(200);
      expect(res.data.data.novel.chapter.viewerState.isRead).toBe(
        true,
      );
      expect(
        res.data.data.novel.chapter.viewerState.readAt,
      ).toBeDateString();
    });
  });

  describe('markChaptersRead mutation', () => {
    it('should mark a single chapter as read for the first time', async () => {
      const authorizationHeader =
        await AuthorizationFixture.getUserAuthorizationHeader();

      const res = await axios.post(
        '/graphql',
        {
          query: `#graphql
            mutation MarkChaptersRead($chapterIds: [ID!]!) {
              markChaptersRead(chapterIDs: $chapterIds) {
                markedCount
              }
            }
          `,
          variables: {
            chapterIds: [CHAPTER_TWO_ID],
          },
        },
        { headers: { Authorization: authorizationHeader } },
      );

      expect(res.status).toBe(200);
      expect(res.data.data.markChaptersRead.markedCount).toBe(1);
    });

    it('should be idempotent (marking same chapter twice)', async () => {
      // Arrange
      const authorizationHeader =
        await AuthorizationFixture.getUserAuthorizationHeader();

      // Act
      const firstRes = await axios.post(
        '/graphql',
        {
          query: `#graphql
            mutation MarkChaptersRead($chapterIds: [ID!]!) {
              markChaptersRead(chapterIDs: $chapterIds) {
                markedCount
              }
            }
          `,
          variables: {
            chapterIds: [CHAPTER_THREE_ID],
          },
        },
        { headers: { Authorization: authorizationHeader } },
      );

      // Assert
      expect(firstRes.data.data.markChaptersRead.markedCount).toBe(1);

      // Act
      const secondRes = await axios.post(
        '/graphql',
        {
          query: `#graphql
            mutation MarkChaptersRead($chapterIds: [ID!]!) {
              markChaptersRead(chapterIDs: $chapterIds) {
                markedCount
              }
            }
          `,
          variables: {
            chapterIds: [CHAPTER_THREE_ID],
          },
        },
        { headers: { Authorization: authorizationHeader } },
      );

      // Assert
      expect(secondRes.data.data.markChaptersRead.markedCount).toBe(
        0,
      );
    });

    it('should count each chapter once when the same user marks the same chapters at the same time', async () => {
      // Arrange
      const authorizationHeader =
        await AuthorizationFixture.getUserAuthorizationHeader({
          fresh: true,
        });
      const chapterIds = [
        CHAPTER_ONE_ID,
        CHAPTER_TWO_ID,
        CHAPTER_THREE_ID,
        CHAPTER_FOUR_ID,
      ];
      const markChaptersRead = () =>
        axios.post(
          '/graphql',
          {
            query: `#graphql
              mutation MarkChaptersRead($chapterIds: [ID!]!) {
                markChaptersRead(chapterIDs: $chapterIds) {
                  markedCount
                }
              }
            `,
            variables: { chapterIds },
          },
          { headers: { Authorization: authorizationHeader } },
        );

      // Act
      const simultaneous = await Promise.all(
        Array.from({ length: 4 }, markChaptersRead),
      );
      const afterwards = await markChaptersRead();

      // Assert
      for (const res of simultaneous) {
        expect(res.data.errors).toBeUndefined();
      }
      expect(
        simultaneous.reduce(
          (total, res) =>
            total + res.data.data.markChaptersRead.markedCount,
          0,
        ),
      ).toBe(chapterIds.length);
      expect(afterwards.data.data.markChaptersRead.markedCount).toBe(
        0,
      );
    });

    it('should filter out invalid chapter IDs', async () => {
      const authorizationHeader =
        await AuthorizationFixture.getUserAuthorizationHeader();
      const NONE_EXISTENT_ID = '8ea8246c-5cc6-47c1-8c8a-996a57fff90f';

      const res = await axios.post(
        '/graphql',
        {
          query: `#graphql
            mutation MarkChaptersRead($chapterIds: [ID!]!) {
              markChaptersRead(chapterIDs: $chapterIds) {
                markedCount
              }
            }
          `,
          variables: {
            chapterIds: [NONE_EXISTENT_ID, CHAPTER_FOUR_ID],
          },
        },
        { headers: { Authorization: authorizationHeader } },
      );

      expect(res.status).toBe(200);
      expect(res.data.data.markChaptersRead.markedCount).toBe(1);
    });

    it('should maintain independent read states for different users', async () => {
      // Arrange
      const userAuthHeader =
        await AuthorizationFixture.getUserAuthorizationHeader();
      const adminUserAuthHeader =
        await AuthorizationFixture.getAdminAuthorizationHeader();
      await axios.post(
        '/graphql',
        {
          query: `#graphql
            mutation MarkChaptersRead($chapterIds: [ID!]!) {
              markChaptersRead(chapterIDs: $chapterIds) {
                markedCount
              }
            }
          `,
          variables: {
            chapterIds: [CHAPTER_FOUR_ID],
          },
        },
        { headers: { Authorization: userAuthHeader } },
      );

      // Act
      const res = await axios.post(
        '/graphql',
        {
          query: `#graphql
            query GetChapterViewerState($novelId: ID!, $chapterId: ID!) {
              novel(id: $novelId) {
                chapter(id: $chapterId) {
                  viewerState {
                    isRead
                  }
                }
              }
            }
          `,
          variables: {
            novelId: NOVEL_ID,
            chapterId: CHAPTER_FOUR_ID,
          },
        },
        { headers: { Authorization: adminUserAuthHeader } },
      );

      // Assert
      expect(
        res.data.data.novel.chapter.viewerState.isRead,
      ).toBeFalse();
    });

    it('should reject unauthenticated requests', async () => {
      const res = await axios.post('/graphql', {
        query: `#graphql
          mutation MarkChaptersRead($chapterIds: [ID!]!) {
            markChaptersRead(chapterIDs: $chapterIds) {
              markedCount
            }
          }
        `,
        variables: {
          chapterIds: [CHAPTER_ONE_ID],
        },
      });

      expect(res.status).toBe(200);
      expect(res.data.errors).toBeArray();
      expect(res.data.errors[0].message).toContain(
        'Missing Bearer token in Authorization header',
      );
    });
  });

  describe('deleteReadHistory mutation', () => {
    it('should delete all read history for authenticated user', async () => {
      const userAuthHeader =
        await AuthorizationFixture.getUserAuthorizationHeader();
      await axios.post(
        '/graphql',
        {
          query: `#graphql
            mutation MarkChaptersRead($chapterIds: [ID!]!) {
              markChaptersRead(chapterIDs: $chapterIds) {
                markedCount
              }
            }
          `,
          variables: {
            chapterIds: [
              CHAPTER_ONE_ID,
              CHAPTER_TWO_ID,
              CHAPTER_THREE_ID,
              CHAPTER_FOUR_ID,
            ],
          },
        },
        { headers: { Authorization: userAuthHeader } },
      );

      const res = await axios.post(
        '/graphql',
        {
          query: `#graphql
            mutation DeleteReadHistory {
              deleteReadHistory {
                deletedCount
              }
            }
          `,
        },
        { headers: { Authorization: userAuthHeader } },
      );

      expect(res.status).toBe(200);
      expect(
        res.data.data.deleteReadHistory.deletedCount,
      ).toBeGreaterThanOrEqual(4);
    });

    it('should return 0 when user has no read history', async () => {
      const writerUserAuthHeader =
        await AuthorizationFixture.getWriterAuthorizationHeader();

      const res = await axios.post(
        '/graphql',
        {
          query: `#graphql
            mutation DeleteReadHistory {
              deleteReadHistory {
                deletedCount
              }
            }
          `,
        },
        { headers: { Authorization: writerUserAuthHeader } },
      );

      expect(res.status).toBe(200);
      expect(res.data.data.deleteReadHistory.deletedCount).toBe(0);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await axios.post('/graphql', {
        query: `#graphql
          mutation DeleteReadHistory {
            deleteReadHistory {
              deletedCount
            }
          }
        `,
      });

      expect(res.status).toBe(200);
      expect(res.data.errors).toBeArray();
      expect(res.data.errors[0].message).toContain(
        'Missing Bearer token in Authorization header',
      );
    });

    it('should verify chapters are no longer marked as read after deletion', async () => {
      const userAuthHeader =
        await AuthorizationFixture.getUserAuthorizationHeader();
      await axios.post(
        '/graphql',
        {
          query: `#graphql
            mutation MarkChaptersRead($chapterIds: [ID!]!) {
              markChaptersRead(chapterIDs: $chapterIds) {
                markedCount
              }
            }
          `,
          variables: {
            chapterIds: [CHAPTER_ONE_ID],
          },
        },
        { headers: { Authorization: userAuthHeader } },
      );

      await axios.post(
        '/graphql',
        {
          query: `#graphql
            mutation DeleteReadHistory {
              deleteReadHistory {
                deletedCount
              }
            }
          `,
        },
        { headers: { Authorization: userAuthHeader } },
      );
      const res = await axios.post(
        '/graphql',
        {
          query: `#graphql
            query GetChapterViewerState($novelId: ID!, $chapterId: ID!) {
              novel(id: $novelId) {
                chapter(id: $chapterId) {
                  viewerState {
                    isRead
                  }
                }
              }
            }
          `,
          variables: {
            novelId: NOVEL_ID,
            chapterId: CHAPTER_ONE_ID,
          },
        },
        { headers: { Authorization: userAuthHeader } },
      );

      expect(
        res.data.data.novel.chapter.viewerState.isRead,
      ).toBeFalse();
    });
  });
});

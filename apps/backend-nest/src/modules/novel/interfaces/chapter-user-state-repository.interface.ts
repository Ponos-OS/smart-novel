import { IChapterUserState } from './chapter-user-state.interface';

export const CHAPTER_USER_STATE_REPOSITORY = Symbol(
  'CHAPTER_USER_STATE_REPOSITORY',
);

export interface IChapterUserStateRepository {
  /**
   * Mark multiple chapters as read for a user
   * @returns Number of new records created (excludes already-read chapters)
   */
  markChaptersRead(
    userId: string,
    chapterData: Array<{ chapterId: string; novelId: string }>,
  ): Promise<number>;

  /**
   * Find all read chapter IDs for a user within a specific novel
   */
  findReadChapterIds(
    userId: string,
    novelId: string,
  ): Promise<string[]>;

  /**
   * Batch load read states for multiple chapters for a single user
   * @returns Map of chapterId -> IChapterUserState
   */
  batchLoadByChapterIds(
    userId: string,
    chapterIds: string[],
  ): Promise<Map<string, IChapterUserState>>;

  /**
   * Delete all read history for a specific user (GDPR compliance)
   * @returns Number of records deleted
   */
  deleteAllForUser(userId: string): Promise<number>;
}

import { PrismaTransactionClient } from '../../prisma';
import { IChapterContent } from './chapter-content.interface';

export interface IChapterContentRepository {
  /**
   * @description Batch fetch content records by their IDs.
   */
  findByIds(ids: string[]): Promise<Map<string, IChapterContent>>;

  /**
   * @description Fetch the content record for a given chapter.
   */
  findByChapterId(chapterId: string): Promise<IChapterContent>;

  /**
   * @description Create or update the content for a chapter. Pass the transaction for transactional writes.
   */
  upsertByChapterId(
    chapterId: string,
    content: string,
    tx?: PrismaTransactionClient,
  ): Promise<IChapterContent>;
}

export const CHAPTER_CONTENT_REPOSITORY = Symbol(
  'CHAPTER_CONTENT_REPOSITORY',
);

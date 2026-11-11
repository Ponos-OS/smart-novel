import { Inject, Injectable, Logger, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';

import {
  CHAPTER_USER_STATE_REPOSITORY,
  type IChapterUserStateRepository,
} from '../interfaces';
import { ChapterViewerState } from '../types';

/**
 * @summary DataLoader for batching and caching user-specific chapter reading state.
 *
 * @description
 * This service uses REQUEST scope, meaning a new instance is created for each HTTP request. The DataLoader is lazily initialized via `setUserId()` because the user context is only available after the request is received (from GraphQL resolver context).
 *
 * Pattern:
 * 1. Service is instantiated per request.
 * 2. Resolver checks if user is authenticated - returns early if not.
 * 3. For authenticated users, resolver calls `setUserId()` with the user's ID.
 * 4. DataLoader is created with a batch function bound to that specific user.
 * 5. All subsequent `load()` calls within that request use the same user-scoped DataLoader.
 *
 * This ensures user data isolation - each request gets its own DataLoader instance
 * that only fetches data for the authenticated user of that request.
 */
@Injectable({ scope: Scope.REQUEST })
export class ChapterViewerStateDataLoader {
  private loader: DataLoader<string, ChapterViewerState> | null =
    null;
  private userId: string | null = null;
  private logger = new Logger(ChapterViewerStateDataLoader.name);

  constructor(
    @Inject(CHAPTER_USER_STATE_REPOSITORY)
    private readonly chapterUserStateRepository: IChapterUserStateRepository,
  ) {}

  setUserId(userId: string): void {
    if (this.loader) {
      return;
    }

    this.userId = userId;
    this.loader = new DataLoader<string, ChapterViewerState>(
      async (chapterIds: readonly string[]) => {
        const stateMap =
          await this.chapterUserStateRepository.batchLoadByChapterIds(
            this.userId!,
            [...chapterIds],
          );

        return chapterIds.map((chapterId) => {
          const state = stateMap.get(chapterId);

          if (state) {
            return {
              isRead: true,
              readAt: state.firstReadAt,
            };
          }

          return {
            isRead: false,
            readAt: undefined,
          };
        });
      },
    );
  }

  load(chapterId: string): Promise<ChapterViewerState> {
    if (!this.loader) {
      throw new Error(
        'DataLoader not initialized. Call setUserId() first.',
      );
    }

    return this.loader.load(chapterId);
  }
}

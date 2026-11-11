import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';
import { MARK_CHAPTERS_READ_MAX_BATCH_SIZE } from '@smart-novel/shared';

import type { IAuthUser } from '../../auth/interfaces';

import { ParseUuidPipe } from '../../../shared';
import { CurrentUser } from '../../auth';
import { ChapterUserStateService } from '../services';
import {
  DeleteReadHistoryResponse,
  MarkChaptersReadResponse,
} from '../types';

@Resolver()
export class ChapterUserStateResolver {
  constructor(
    private readonly chapterUserStateService: ChapterUserStateService,
  ) {}

  @Mutation(() => MarkChaptersReadResponse, {
    description: `Mark one or more chapters as read for the authenticated user. Maximum ${MARK_CHAPTERS_READ_MAX_BATCH_SIZE} chapter IDs per request.`,
  })
  async markChaptersRead(
    @CurrentUser() user: IAuthUser,
    @Args('chapterIds', { type: () => [ID] }, ParseUuidPipe)
    chapterIds: string[],
  ): Promise<MarkChaptersReadResponse> {
    const markedCount =
      await this.chapterUserStateService.markChaptersRead(
        user.sub,
        chapterIds,
      );

    return { markedCount };
  }

  @Mutation(() => DeleteReadHistoryResponse, {
    description:
      'Delete all read history for the authenticated user (GDPR compliance).',
  })
  async deleteReadHistory(
    @CurrentUser() user: IAuthUser,
  ): Promise<DeleteReadHistoryResponse> {
    const deletedCount =
      await this.chapterUserStateService.deleteReadHistory(user.sub);

    return { deletedCount };
  }
}

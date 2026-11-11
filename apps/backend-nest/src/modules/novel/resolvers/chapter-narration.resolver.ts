import {
  Args,
  ID,
  Mutation,
  Resolver,
  Subscription,
} from '@nestjs/graphql';

import { ParseUuidPipe } from '../../../shared';
import { AuthHeader, CheckPolicy, Public } from '../../auth';
import { ChapterNarrationService } from '../services';
import {
  ChapterNarrationEvent,
  ChapterNarrationResponse,
} from '../types';

@Resolver()
export class ChapterNarrationResolver {
  constructor(
    private readonly narrationService: ChapterNarrationService,
  ) {}

  /**
   * Triggers chapter audio generation and returns immediately with status
   */
  @CheckPolicy('chapter', 'update')
  @Mutation(() => ChapterNarrationResponse, {
    name: 'generateChapterAudio',
    description: 'Start generating audio narration for a chapter',
  })
  async generateChapterAudio(
    @Args(
      'id',
      { type: () => ID, description: 'The ID of the chapter' },
      ParseUuidPipe,
    )
    chapterId: string,
    @AuthHeader() authorization: string,
  ): Promise<ChapterNarrationResponse> {
    return this.narrationService.generateChapterAudio(
      chapterId,
      authorization,
    );
  }

  /**
   * Subscribe to real-time updates for chapter narration generation
   */
  @Public()
  @Subscription(() => ChapterNarrationEvent, {
    name: 'chapterNarrationUpdated',
    description:
      'Receive real-time updates when chapter narration status changes',
    filter: (payload, variables) => {
      return (
        payload.chapterNarrationUpdated.chapterId ===
        variables.chapterId
      );
    },
  })
  chapterNarrationUpdated(
    @Args('chapterId', { type: () => ID }, ParseUuidPipe)
    chapterId: string,
  ) {
    return this.narrationService.subscribeToChapterNarration(
      chapterId,
    );
  }
}

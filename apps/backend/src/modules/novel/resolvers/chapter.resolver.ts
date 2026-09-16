import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';

import {
  IsoDateTimePipe,
  ParseUuidPipe,
  RequiredStringPipe,
} from '../../../shared';
import { AuthHeader, CheckPolicy } from '../../auth';
import { UpdateChapterInput } from '../inputs';
import { ChapterNarrationService, ChapterService } from '../services';
import { Chapter } from '../types';

@Resolver(() => Chapter)
export class ChapterResolver {
  constructor(
    private readonly chapterService: ChapterService,
    private readonly chapterNarrationService: ChapterNarrationService,
  ) {}

  @CheckPolicy('chapter', 'update')
  @Mutation(() => Chapter, {
    description:
      "Update a chapter's content. Saving will regenerate the chapter's audio narration once that feature ships — there is no draft support here; use a VCS if you want to draft before saving. This is a no-op, if the content is byte-identical to what's already stored.",
  })
  async updateContent(
    @Args(
      'id',
      {
        type: () => ID,
        description: 'Chapter ID',
      },
      ParseUuidPipe,
    )
    chapterId: string,
    @Args(
      'content',
      {
        type: () => String,
        description: 'Chapter content in markdown format',
      },
      RequiredStringPipe,
    )
    content: string,
    @Args(
      'expectedContentUpdatedAt',
      {
        type: () => String,
        description:
          "ISO 8601 timestamp of the content version this edit was based on (from Chapter.contentUpdatedAt). The mutation is rejected if the chapter's content has changed since.",
      },
      IsoDateTimePipe,
    )
    expectedContentUpdatedAt: string,
    @AuthHeader() authorization: string,
  ) {
    const { chapter, contentChanged } =
      await this.chapterService.updateContent(
        chapterId,
        content,
        expectedContentUpdatedAt,
      );

    if (contentChanged) {
      await this.chapterNarrationService.regenerateAudio(
        chapterId,
        content,
        authorization,
      );
    }

    return chapter;
  }

  @CheckPolicy('chapter', 'update')
  @Mutation(() => Chapter, {
    description: "Update a chapter's metadata, e.g. its title.",
  })
  async updateChapter(
    @Args(
      'id',
      {
        type: () => ID,
        description: 'Chapter ID',
      },
      ParseUuidPipe,
    )
    chapterId: string,
    @Args('input', {
      type: () => UpdateChapterInput,
      description: 'Chapter metadata fields to update',
    })
    input: UpdateChapterInput,
    @Args(
      'expectedUpdatedAt',
      {
        type: () => String,
        description:
          'ISO 8601 timestamp of the chapter version this edit was based on (from Chapter.updatedAt). The mutation is rejected if the chapter has changed since.',
      },
      IsoDateTimePipe,
    )
    expectedUpdatedAt: string,
  ) {
    return this.chapterService.updateChapter(
      chapterId,
      input,
      expectedUpdatedAt,
    );
  }
}

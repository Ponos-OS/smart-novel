import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';

import { ParseUuidPipe, RequiredStringPipe } from '../../../shared';
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
      "Update a chapter's content. Saving will regenerate the chapter's audio narration once that feature ships — there is no draft support here; use a VCS if you want to draft before saving.",
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
    @AuthHeader() authorization: string,
  ) {
    const chapter = await this.chapterService.updateContent(
      chapterId,
      content,
    );

    await this.chapterNarrationService.regenerateAudio(
      chapterId,
      content,
      authorization,
    );

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
  ) {
    return this.chapterService.updateChapter(chapterId, input);
  }
}

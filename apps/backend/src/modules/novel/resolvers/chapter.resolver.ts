import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';

import { ParseUuidPipe, RequiredStringPipe } from '../../../shared';
import { CheckPolicy } from '../../auth';
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
  ) {
    const chapter = await this.chapterService.updateContent(
      chapterId,
      content,
    );

    await this.chapterNarrationService.regenerateAudio(
      chapterId,
      content,
    );

    return chapter;
  }

  // @Mutation(() => Chapter, { description: 'Internal mutation for writers to add new chapters.' })
  // async createChapter(
  //   @Args('novelId', {
  //     type: () => ID,
  //     description: 'Adds the new chapter to the novel'
  //   })
  //   novelId: string,
  //   @Args('input', {
  //     type: () => CreateChapterInput,
  //     description: 'Create a new chapter for a novel'
  //   })
  //   input: CreateChapterInput,
  //   @Args('makeNecessaryAdjustments', {
  //     type: () => Boolean,
  //     description: 'Backend will make necessary adjustments so the chapter numbers make sense even after inserting a chapter in the middle of existing chapters. The default value for this argument is false.',
  //     defaultValue: false,
  //   })
  //   makeNecessaryAdjustments: boolean = false
  // ) {
  //   return this.chapterService.createChapter(novelId, input, makeNecessaryAdjustments)
  // }

  // @Mutation(() => Chapter, { description: 'Internal mutation for writers to update chapters.' })
  // async updateChapter(
  //   @Args('id', {
  //     type: () => ID,
  //     description: 'The ID of the chapter to update',
  //   })
  //   chapterId: string,
  //   @Args('input', {
  //     type: () => UpdateChapterInput
  //   })
  //   input: UpdateChapterInput,
  //   @Args('makeNecessaryAdjustments', {
  //     type: () => Boolean,
  //     description: 'Backend will make necessary adjustments so the chapter numbers make sense even after inserting a chapter in the middle of existing chapters. The default value for this argument is false.',
  //     defaultValue: false,
  //   })
  //   makeNecessaryAdjustments: boolean = false
  // ) {
  //   return this.chapterService.updateChapter(chapterId, input, makeNecessaryAdjustments)
  // }
}

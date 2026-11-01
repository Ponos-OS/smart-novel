import { Int, Parent, ResolveField, Resolver } from '@nestjs/graphql';

import { Public } from '../../auth';
import { NovelChapterCountDataLoader } from '../dataloaders';
import { Novel } from '../types';

@Public()
@Resolver(() => Novel)
export class NovelChapterCountFieldResolver {
  constructor(
    private readonly chapterCountDataLoader: NovelChapterCountDataLoader,
  ) {}

  @ResolveField(() => Int, {
    description:
      'An estimate of how many chapters the novel has, taken from the database planner rather than counted. It can be off, most for small numbers, and is never exact.',
  })
  estimatedChapterCount(@Parent() novel: Novel): Promise<number> {
    return this.chapterCountDataLoader.load(novel.id);
  }
}

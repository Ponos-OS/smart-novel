import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { NarrationStatus } from '@prisma/client';

import { IChapter } from '../interfaces';

@ObjectType({ description: 'A chapter of a novel' })
export class Chapter implements IChapter {
  @Field(() => ID, {
    description: 'Unique identifier for the chapter',
  })
  id: string;

  @Field(() => ID, {
    description: 'The ID of the novel this chapter belongs to',
  })
  novelId: string;

  @Field({ description: 'The title of the chapter' })
  title: string;

  @Field(() => Int, { description: 'The chapter number' })
  chapterNumber: number;

  @Field(() => ID, {
    description: 'FK to the chapter content record',
  })
  contentId: string;

  @Field({ description: 'The creation date of the chapter' })
  createdAt: string;

  @Field({ description: 'The last update date of the chapter' })
  updatedAt: string;

  @Field(() => NarrationStatus, {
    nullable: true,
    description: 'The status of audio narration generation',
  })
  narrationStatus?: NarrationStatus;

  @Field({
    nullable: true,
    description: 'Public URL to the audio narration file',
  })
  narrationUrl?: string;

  @Field(() => Chapter, {
    nullable: true,
    description: 'The next chapter',
  })
  next?: Chapter;

  @Field(() => Chapter, {
    nullable: true,
    description: 'The previous chapter',
  })
  previous?: Chapter;
}

import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ChapterViewerState {
  @Field(() => Boolean, {
    description: 'Whether the current user has read this chapter',
  })
  isRead: boolean;

  @Field(() => String, {
    nullable: true,
    description:
      'ISO timestamp when the chapter was first marked as read',
  })
  readAt?: string;
}

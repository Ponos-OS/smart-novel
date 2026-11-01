import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ContentStats {
  @Field(() => Int, {
    description:
      "The planner's estimate of the number of novels right now, not an exact count (it is as fresh as the last `ANALYZE`). 0 when the estimate cannot be read.",
  })
  estimatedNovelCount: number;

  @Field(() => Int, {
    description:
      "The planner's estimate of the number of chapters right now, not an exact count. 0 when the estimate cannot be read.",
  })
  estimatedChapterCount: number;
}

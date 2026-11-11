import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MarkChaptersReadResponse {
  @Field(() => Int, {
    description:
      'Number of NEW chapters marked as read (excludes already-read chapters)',
  })
  markedCount: number;
}

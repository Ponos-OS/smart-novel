import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class DeleteChapterResponse {
  @Field(() => ID, { description: 'ID of the deleted chapter' })
  id: string;

  @Field(() => ID, {
    description: 'ID of the novel the chapter belonged to',
  })
  novelId: string;
}

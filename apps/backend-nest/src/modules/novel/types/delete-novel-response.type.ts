import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class DeleteNovelResponse {
  @Field(() => ID, { description: 'ID of the deleted novel' })
  id: string;
}

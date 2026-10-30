import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class DeleteCategoryResponse {
  @Field(() => ID, { description: 'ID of the deleted category' })
  id: string;
}

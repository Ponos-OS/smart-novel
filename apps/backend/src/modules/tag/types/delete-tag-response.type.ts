import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class DeleteTagResponse {
  @Field(() => ID, { description: 'ID of the deleted tag' })
  id: string;
}

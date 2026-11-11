import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class DeleteReadHistoryResponse {
  @Field(() => Int, {
    description: 'Number of chapter read records deleted',
  })
  deletedCount: number;
}

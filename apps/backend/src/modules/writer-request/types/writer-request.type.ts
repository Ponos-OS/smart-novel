import {
  Field,
  ID,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { WriterRequestStatus } from '@prisma/client';

registerEnumType(WriterRequestStatus, {
  name: 'WriterRequestStatus',
  description:
    'PENDING waits for an admin; APPROVED and REJECTED are kept as history',
});

@ObjectType({ description: 'A request to become a writer' })
export class WriterRequest {
  @Field(() => ID)
  id: string;

  @Field()
  note: string;

  @Field(() => WriterRequestStatus)
  status: WriterRequestStatus;

  @Field(() => String, {
    nullable: true,
    description: 'Why an admin rejected the request, when they said',
  })
  rejectionReason?: string | null;

  @Field()
  createdAt: Date;

  @Field(() => Date, { nullable: true })
  reviewedAt?: Date | null;
}

import {
  Field,
  ID,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { WriterStatus } from '@prisma/client';

registerEnumType(WriterStatus, {
  name: 'WriterStatus',
  description:
    'PENDING waits for an admin; APPROVED and REJECTED are kept as history',
});

@ObjectType({ description: 'A request to become a writer' })
export class Writer {
  @Field(() => ID)
  id: string;

  @Field(() => ID, {
    description:
      'The ID of the requester in the identity provider, the `ownerId` of their novels',
  })
  userId: string;

  @Field({ description: 'The name of the requester when they asked' })
  name: string;

  @Field({
    description: 'The email of the requester when they asked',
  })
  email: string;

  @Field()
  note: string;

  @Field(() => WriterStatus)
  status: WriterStatus;

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

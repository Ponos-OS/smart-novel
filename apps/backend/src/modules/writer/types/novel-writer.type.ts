import { Field, ID, ObjectType } from '@nestjs/graphql';
import { WriterStatus } from '@prisma/client';

import { WriterApplication } from './writer-application.type';

@ObjectType({
  description:
    'The writer of a novel. Everybody sees the pen name; the real name, the email and the applications only admins see (null for everybody else), and only an approved writer is shown to anybody but an admin.',
})
export class NovelWriter {
  @Field(() => ID, {
    description: 'The ID of the writer in the identity provider',
  })
  userId: string;

  @Field({ description: 'The name readers see' })
  penName: string;

  @Field(() => String, { nullable: true, description: 'Admins only' })
  name?: string | null;

  @Field(() => String, { nullable: true, description: 'Admins only' })
  email?: string | null;

  @Field(() => WriterStatus, {
    nullable: true,
    description: 'Admins only',
  })
  status?: WriterStatus | null;

  @Field(() => Date, { nullable: true, description: 'Admins only' })
  createdAt?: Date | null;

  @Field(() => [WriterApplication], {
    nullable: true,
    description: 'Admins only; oldest first',
  })
  applications?: WriterApplication[] | null;
}

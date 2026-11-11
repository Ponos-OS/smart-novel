import {
  Field,
  ID,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { WriterStatus } from '@prisma/client';

import { WriterApplication } from './writer-application.type';

registerEnumType(WriterStatus, {
  name: 'WriterStatus',
  description:
    'PENDING waits for an admin; a REJECTED user may apply again',
});

@ObjectType({
  description:
    'A writer, or a user who applied to become one, with the history of their applications',
})
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
    description:
      'The pen name the writer chose: English letters, hyphens and underscores, unique across writers in any case',
  })
  penName: string;

  @Field({
    description: 'The email of the requester when they asked',
  })
  email: string;

  @Field(() => WriterStatus)
  status: WriterStatus;

  @Field()
  createdAt: Date;

  @Field(() => [WriterApplication], {
    description:
      'Every application of the writer, oldest first; the last one is the current one',
  })
  applications: WriterApplication[];
}

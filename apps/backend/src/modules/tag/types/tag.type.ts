import {
  Field,
  ID,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { TagStatus } from '@prisma/client';

registerEnumType(TagStatus, {
  name: 'TagStatus',
  description:
    'APPROVED tags can be put on novels; PENDING ones were requested by a writer and wait for an admin',
});

@ObjectType({ description: 'A novel tag' })
export class Tag {
  @Field(() => ID)
  id: string;

  @Field({ description: 'Normalized: trimmed and lower-cased' })
  name: string;

  @Field({
    description:
      'A short text for writers and readers; empty until an admin writes one',
  })
  description: string;

  @Field(() => TagStatus)
  status: TagStatus;

  /** @description Exposed only to admins, by `TagFieldResolver`. */
  requesterUserId?: string | null;
}

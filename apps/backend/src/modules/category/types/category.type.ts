import {
  Field,
  ID,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { CategoryStatus } from '@prisma/client';

registerEnumType(CategoryStatus, {
  name: 'CategoryStatus',
  description:
    'APPROVED categories can be put on novels; PENDING ones were requested by a writer and wait for an admin',
});

@ObjectType({ description: 'A novel category' })
export class Category {
  @Field(() => ID)
  id: string;

  @Field({ description: 'Normalized: trimmed and lower-cased' })
  name: string;

  @Field(() => CategoryStatus)
  status: CategoryStatus;

  /** @description Exposed only to admins, by `CategoryFieldResolver`. */
  requesterUserId?: string | null;
}

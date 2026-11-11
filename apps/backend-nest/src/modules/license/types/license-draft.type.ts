import { Field, ID, ObjectType } from '@nestjs/graphql';
import { LicenseSourceType } from '@prisma/client';

@ObjectType()
export class LicenseDraftSource {
  @Field(() => LicenseSourceType)
  type: LicenseSourceType;

  @Field(() => String, {
    nullable: true,
    description:
      'The canonical license the draft is, or was modified from. Null for CUSTOM.',
  })
  canonicalId: string | null;
}

@ObjectType({
  description:
    'A license being worked on. Private to its writer, it is not a license yet: finalize it to get one.',
})
export class LicenseDraft {
  @Field(() => ID)
  id: string;

  @Field(() => String, {
    description: 'The writer who owns the draft',
  })
  ownerId: string;

  @Field(() => String, {
    description:
      'The name of the license; may be empty while drafting',
  })
  title: string;

  @Field(() => String, {
    description:
      'The text of the license; may be empty while drafting',
  })
  text: string;

  @Field(() => LicenseDraftSource)
  source: LicenseDraftSource;

  @Field(() => String, { description: 'ISO date of the last save' })
  updatedAt: string;
}

import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'The current platform terms.' })
export class PlatformTerms {
  @Field(() => Int, {
    description: 'Bumped whenever the text changes',
  })
  version: number;

  @Field({ description: 'The terms, as markdown' })
  markdown: string;
}

@ObjectType({
  description:
    'Whether the caller accepted the current platform terms.',
})
export class PlatformTermsStatus {
  @Field(() => Int)
  requiredVersion: number;

  @Field(() => Int, {
    nullable: true,
    description: 'The newest version the caller accepted, if any',
  })
  acceptedVersion: number | null;

  @Field({
    description: 'True when the required version was accepted',
  })
  accepted: boolean;
}

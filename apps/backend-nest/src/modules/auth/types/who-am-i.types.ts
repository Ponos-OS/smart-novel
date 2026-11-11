import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class WhoAmI {
  @Field(() => String, {
    description: 'Subject identifier (unique user ID from the IdP)',
  })
  sub: string;

  @Field(() => String, {
    description: 'User\'s full display name (e.g. "Admin User")',
  })
  name: string;

  @Field(() => String, {
    description: "User's preferred username / login name",
  })
  preferredUsername: string;

  @Field(() => String, {
    description: "User's email address",
  })
  email: string;

  @Field(() => Boolean, {
    description: 'Whether the email has been verified by the IdP',
  })
  emailVerified: boolean;

  @Field(() => String, {
    nullable: true,
    description: 'Organization / tenant ID the user belongs to',
  })
  orgId?: string;

  @Field(() => [String], {
    description:
      'Roles assigned to the user (project-scoped or global)',
  })
  roles: string[];
}

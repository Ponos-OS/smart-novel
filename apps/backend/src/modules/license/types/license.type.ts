import {
  Field,
  ID,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { LicenseSourceType } from '@prisma/client';

registerEnumType(LicenseSourceType, {
  name: 'LicenseSourceType',
  description:
    'CANONICAL is a pre-written license stored verbatim, FORKED is modified from a canonical one, CUSTOM has no base',
});

export enum LicenseScope {
  DRAFT = 'DRAFT',
  PERSONAL = 'PERSONAL',
  SHARED = 'SHARED',
}

registerEnumType(LicenseScope, {
  name: 'LicenseScope',
  description:
    'SHARED belongs to the platform and any writer may use it, PERSONAL was finalized by a writer and is private to them, DRAFT is still being worked on',
});

@ObjectType({ description: 'A stored, immutable license text.' })
export class License {
  @Field(() => ID)
  id: string;

  @Field({ description: 'E.g. "CC BY 4.0"' })
  name: string;

  @Field(() => LicenseSourceType)
  sourceType: LicenseSourceType;

  @Field(() => String, {
    nullable: true,
    description:
      'The canonical license it is, or was modified from, e.g. "CC-BY-4.0"',
  })
  canonicalId: string | null;

  @Field({ description: 'The full license text' })
  text: string;

  /**
   * @internal field — not exposed in the GraphQL schema. `scope` is derived from it by the field resolver.
   */
  isDraft: boolean;

  @Field({
    description:
      'Whether new novels get this license when none is chosen',
  })
  isDefault: boolean;

  @Field(() => String, {
    description:
      '"system" for a shared license, otherwise the writer who owns it',
  })
  ownerId: string;

  @Field()
  createdAt: Date;

  @Field({
    description: 'The last save; a license changes only as a draft',
  })
  updatedAt: Date;

  /**
   * Resolved by the `officialUrl` field resolver, never stored.
   */
  @Field(() => String, {
    nullable: true,
    description:
      'Link to the authoritative text of the canonical license this is, or was modified from. Null for CUSTOM, or when the registry cannot be reached.',
  })
  officialUrl?: string | null;
}

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
   * Resolved by the `officialUrl` field resolver, never stored.
   */
  @Field(() => String, {
    nullable: true,
    description:
      'Link to the authoritative text of the canonical license this is, or was modified from. Null for CUSTOM, or when the registry cannot be reached.',
  })
  officialUrl?: string | null;
}

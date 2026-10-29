import {
  Field,
  ID,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { LicenseSourceType } from '@prisma/client';

export enum LicenseAssistantMessageRole {
  ASSISTANT = 'ASSISTANT',
  USER = 'USER',
}

registerEnumType(LicenseAssistantMessageRole, {
  name: 'LicenseAssistantMessageRole',
});

@ObjectType()
export class LicenseAssistantDraftSource {
  @Field(() => LicenseSourceType)
  type: LicenseSourceType;

  @Field(() => String, {
    nullable: true,
    description:
      'The canonical license the draft is, or was modified from. Null for CUSTOM.',
  })
  canonicalId: string | null;
}

@ObjectType({ description: 'The license text being worked on.' })
export class LicenseAssistantDraft {
  @Field()
  title: string;

  @Field({ description: 'The draft text, as Markdown' })
  text: string;

  @Field(() => LicenseAssistantDraftSource)
  source: LicenseAssistantDraftSource;
}

@ObjectType()
export class LicenseAssistantMessage {
  @Field(() => LicenseAssistantMessageRole)
  role: LicenseAssistantMessageRole;

  @Field()
  content: string;
}

@ObjectType({ description: 'The assistant answer to one message.' })
export class LicenseAssistantTurn {
  @Field()
  assistantMessage: string;

  @Field(() => LicenseAssistantDraft, { nullable: true })
  draft: LicenseAssistantDraft | null;

  @Field({
    description:
      'False when the assistant only explained something; the draft must not be flashed then',
  })
  draftChanged: boolean;

  @Field(() => [String], {
    description: 'Canonical license ids the assistant suggests',
  })
  recommendations: string[];

  @Field(() => [String], {
    description: 'Always non-empty and always to be shown',
  })
  disclaimers: string[];

  @Field({
    description:
      "The assistant's opinion on readiness. The client decides whether to act on it.",
  })
  isReadyToFinalize: boolean;

  @Field(() => [LicenseAssistantMessage], {
    description:
      'The conversation to send as `conversation` on the next request, exactly as returned. A long history is condensed in it, so keep your own transcript to show every message.',
  })
  conversation: LicenseAssistantMessage[];
}

@ObjectType({
  description: 'A canonical license of the Fithara registry.',
})
export class CanonicalLicenseSummary {
  @Field(() => ID, { description: 'E.g. "CC-BY-NC-4.0"' })
  id: string;

  @Field()
  name: string;

  @Field()
  shortName: string;

  @Field()
  version: string;

  @Field()
  category: string;

  @Field({ description: 'Link to the authoritative license text' })
  officialUrl: string;

  @Field()
  summary: string;

  @Field(() => [String])
  permissions: string[];

  @Field(() => [String])
  limitations: string[];

  @Field(() => [String])
  conditions: string[];
}

@ObjectType()
export class CanonicalLicense extends CanonicalLicenseSummary {
  @Field({ description: 'The full license text' })
  body: string;
}

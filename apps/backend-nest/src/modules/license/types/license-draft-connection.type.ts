import { ObjectType } from '@nestjs/graphql';
import { ConnectionType, EdgeType } from 'nestjs-backend-common';

import { LicenseDraft } from './license-draft.type';

@ObjectType({
  description: 'An edge in a connection representing a license draft',
})
export class LicenseDraftEdge extends EdgeType(LicenseDraft) {}

@ObjectType({
  description: 'A connection representing a list of license drafts',
})
export class LicenseDraftConnection extends ConnectionType(
  LicenseDraft,
  LicenseDraftEdge,
) {}

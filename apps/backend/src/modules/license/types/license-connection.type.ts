import { ObjectType } from '@nestjs/graphql';
import { ConnectionType, EdgeType } from 'nestjs-backend-common';

import { License } from './license.type';

@ObjectType({
  description: 'An edge in a connection representing a license',
})
export class LicenseEdge extends EdgeType(License) {}

@ObjectType({
  description: 'A connection representing a list of licenses',
})
export class LicenseConnection extends ConnectionType(
  License,
  LicenseEdge,
) {}

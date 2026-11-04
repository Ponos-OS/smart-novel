import { ObjectType } from '@nestjs/graphql';
import { ConnectionType, EdgeType } from 'nestjs-backend-common';

import { Tag } from './tag.type';

@ObjectType({
  description: 'An edge in a connection representing a tag',
})
export class TagEdge extends EdgeType(Tag) {}

@ObjectType({
  description: 'A connection representing a list of tags',
})
export class TagConnection extends ConnectionType(Tag, TagEdge) {}

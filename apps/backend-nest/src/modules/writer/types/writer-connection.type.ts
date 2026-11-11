import { ObjectType } from '@nestjs/graphql';
import { ConnectionType, EdgeType } from 'nestjs-backend-common';

import { Writer } from './writer.type';

@ObjectType({
  description:
    'An edge in a connection representing a writer request',
})
export class WriterEdge extends EdgeType(Writer) {}

@ObjectType({
  description: 'A connection representing a list of writer requests',
})
export class WriterConnection extends ConnectionType(
  Writer,
  WriterEdge,
) {}

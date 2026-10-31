import { ObjectType } from '@nestjs/graphql';
import { ConnectionType, EdgeType } from 'nestjs-backend-common';

import { WriterRequest } from './writer-request.type';

@ObjectType({
  description:
    'An edge in a connection representing a writer request',
})
export class WriterRequestEdge extends EdgeType(WriterRequest) {}

@ObjectType({
  description: 'A connection representing a list of writer requests',
})
export class WriterRequestConnection extends ConnectionType(
  WriterRequest,
  WriterRequestEdge,
) {}

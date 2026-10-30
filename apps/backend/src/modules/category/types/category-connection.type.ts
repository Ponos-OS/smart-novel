import { ObjectType } from '@nestjs/graphql';
import { ConnectionType, EdgeType } from 'nestjs-backend-common';

import { Category } from './category.type';

@ObjectType({
  description: 'An edge in a connection representing a category',
})
export class CategoryEdge extends EdgeType(Category) {}

@ObjectType({
  description: 'A connection representing a list of categories',
})
export class CategoryConnection extends ConnectionType(
  Category,
  CategoryEdge,
) {}

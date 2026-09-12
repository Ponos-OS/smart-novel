import {
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * @description
 * Extract the raw `Authorization` header value from the GraphQL context
 */
export const AuthHeader = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;

    return request.headers?.authorization;
  },
);

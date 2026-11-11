import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import type { IAuthUser } from '../interfaces';

/**
 * @description JwtAuthGuard sets request.user after successful JWT validation
 */
function extractUserFromContext(
  context: ExecutionContext,
): IAuthUser | undefined {
  const ctx = GqlExecutionContext.create(context);
  const request = ctx.getContext().req;

  return request.user;
}

/**
 * @description
 * Extract the authenticated `IAuthUser` from the GraphQL context.
 *
 * The user is placed on the request by `JwtAuthGuard` after JWT validation via `ZitadelAuthProvider.validateToken()`.
 *
 * @example `@CurrentUser() user: IAuthUser`
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): IAuthUser => {
    const user = extractUserFromContext(context);

    if (!user) {
      throw new UnauthorizedException('Not authenticated');
    }

    return user;
  },
);
export const CurrentUserOptional = createParamDecorator(
  (
    _data: unknown,
    context: ExecutionContext,
  ): IAuthUser | undefined => {
    const user = extractUserFromContext(context);

    return user;
  },
);

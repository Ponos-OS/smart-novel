import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { hasMinimumRole, Role } from '@smart-novel/shared';
import { CustomLoggerService } from 'nestjs-backend-common';

import type { IAuthUser } from '../interfaces';

import { IS_PUBLIC_KEY, REQUIRE_ROLE_KEY } from '../decorators';

/**
 * @description role-based guard.
 *
 * Reads `@RequireRole()` metadata and checks whether the authenticated user's highest role meets or exceeds the required level.
 *
 * **Note**: This guard is for endpoints that only need a role gate - no resource ownership check. For resource-level ABAC checks, use `PoliciesGuard` with `@CheckPolicy()` instead.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly logger: CustomLoggerService,
  ) {}

  canActivate(executionContext: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [executionContext.getHandler(), executionContext.getClass()],
    );

    if (isPublic) {
      return true;
    }

    const requiredRole = this.reflector.getAllAndOverride<Role>(
      REQUIRE_ROLE_KEY,
      [executionContext.getHandler(), executionContext.getClass()],
    );

    if (!requiredRole) {
      return true;
    }

    const context = GqlExecutionContext.create(executionContext);
    const request = context.getContext().req;
    const user: IAuthUser | undefined = request.user;

    if (!user) {
      throw new ForbiddenException(
        'No authenticated user found for role check',
      );
    }

    const allowed = hasMinimumRole(user.roles, requiredRole);

    if (!allowed) {
      this.logger.warn(
        `Role check denied: user=${user.sub} roles=[${user.roles.join(',')}] required=${requiredRole}`,
      );

      throw new ForbiddenException(
        `You need at least the "${requiredRole}" role to perform this action`,
      );
    }

    return true;
  }
}

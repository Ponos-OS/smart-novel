import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { CustomLoggerService } from 'nestjs-backend-common';

import {
  CHECK_POLICY_KEY,
  CheckPolicyMetadata,
  IS_PUBLIC_KEY,
} from '../decorators';
import {
  AUTHORIZATION_PROVIDER,
  type IAuthorizationProvider,
  type IAuthUser,
} from '../interfaces';

/**
 * @description
 * GraphQL-aware ABAC policies guard.
 * Reads `@CheckPolicy()` metadata and calls the injected `IAuthorizationProvider` to make attribute-based access decisions.
 *
 * Expects the `JwtAuthGuard` to have already run and attached the `IAuthUser` to `request.user`.
 */
@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    @Inject(AUTHORIZATION_PROVIDER)
    private readonly authzProvider: IAuthorizationProvider,
    private readonly reflector: Reflector,
    private readonly logger: CustomLoggerService,
  ) {}

  async canActivate(
    executionContext: ExecutionContext,
  ): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [executionContext.getHandler(), executionContext.getClass()],
    );

    if (isPublic) {
      return true;
    }

    const policyMeta =
      this.reflector.getAllAndOverride<CheckPolicyMetadata>(
        CHECK_POLICY_KEY,
        [executionContext.getHandler(), executionContext.getClass()],
      );

    if (!policyMeta) {
      return true;
    }

    const context = GqlExecutionContext.create(executionContext);
    const request = context.getContext().req;
    const user: IAuthUser | undefined = request.user;

    if (!user) {
      throw new ForbiddenException(
        'No authenticated user found for policy check',
      );
    }

    const args = context.getArgs() as RequestArgs;
    const rawResourceId = args[policyMeta.idArg];

    // A missing explicit idArg is a decorator/resolver mismatch, not an expected case, so it throws instead of silently checking against 'unknown'.
    if (rawResourceId === undefined && policyMeta.idArg !== 'id') {
      throw new Error(
        `@CheckPolicy('${policyMeta.resource}', '${policyMeta.action}', '${policyMeta.idArg}') misconfigured: no GraphQL arg named "${policyMeta.idArg}" was found.`,
      );
    }

    /**
     * @description the value is resolved from the GraphQL argument named by `@CheckPolicy`'s `idArg` (default `'id'`). A missing default `id` arg (e.g. on a `create`) falls back to `'unknown'`, since many actions never need an id at all.
     */
    const resourceId = String(rawResourceId ?? 'unknown');
    const allowed = await this.authzProvider.isAllowed({
      principal: user,
      resource: policyMeta.resource,
      resourceId,
      action: policyMeta.action,
    });

    if (!allowed) {
      this.logger.warn(
        `Access denied: user=${user.sub} action=${policyMeta.action} resource=${policyMeta.resource}/${resourceId}`,
      );

      throw new ForbiddenException(
        `You do not have permission to ${policyMeta.action} this ${policyMeta.resource}`,
      );
    }

    return true;
  }
}

interface RequestArgs {
  [key: string]: unknown;
}

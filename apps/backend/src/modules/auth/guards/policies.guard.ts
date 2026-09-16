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
 *
 * `resourceId` is resolved from a GQL arg literally named `id`. That's all this guard can
 * check generically — anything that needs a specific field's value (e.g. ownership of a
 * parent resource on `create`) is checked explicitly in the resolver body instead, using its
 * own typed arguments. See `ChapterResolver.createChapter`/`ChapterPolicy.canCreateInNovel`.
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
    const resourceId = args.id ?? 'unknown';

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
  id?: string;
  [key: string]: unknown;
}

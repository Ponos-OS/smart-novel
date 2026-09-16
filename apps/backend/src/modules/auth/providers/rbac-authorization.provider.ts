import { Injectable } from '@nestjs/common';
import { CustomLoggerService } from 'nestjs-backend-common';

import {
  AuthzCheckParams,
  type IAuthorizationProvider,
} from '../interfaces';
import {
  ChapterPolicy,
  IResourcePolicy,
  NovelPolicy,
} from '../policies';

/**
 * @description
 * RBAC authorization provider — delegates to a per-resource `IResourcePolicy` registered by
 * resource name in {@link policiesByResource}. Adding a new resource type means adding a new
 * `IResourcePolicy` implementation and registering it below, not editing a shared switch.
 *
 * Implement `IAuthorizationProvider` directly for Cerbos, OPA, Cedar, or another engine if
 * this ever needs to be swapped out; see each policy class for its permission model.
 */
@Injectable()
export class RbacAuthorizationProvider implements IAuthorizationProvider {
  private readonly policiesByResource: ReadonlyMap<
    string,
    IResourcePolicy
  >;

  constructor(
    private readonly logger: CustomLoggerService,
    novelPolicy: NovelPolicy,
    chapterPolicy: ChapterPolicy,
  ) {
    this.policiesByResource = new Map<string, IResourcePolicy>([
      ['novel', novelPolicy],
      ['chapter', chapterPolicy],
    ]);
    this.logger.log('RBAC authorization provider initialized');
  }

  async isAllowed(params: AuthzCheckParams): Promise<boolean> {
    const {
      principal,
      resource,
      resourceId,
      action,
      resourceAttributes,
    } = params;
    const policy = this.policiesByResource.get(resource);

    if (!policy) {
      this.logger.warn(
        `Unknown resource type: ${resource}. Denying access.`,
      );
      return false;
    }

    const allowed = await policy.isAllowed({
      userId: principal.sub,
      userRoles: principal.roles,
      resourceId,
      action,
      resourceAttributes,
    });

    this.logger.debug(
      `RBAC check: principal=${principal.sub} roles=[${principal.roles.join(',')}] action=${action} resource=${resource}/${resourceId} => ${allowed ? 'ALLOW' : 'DENY'}`,
    );

    return allowed;
  }
}

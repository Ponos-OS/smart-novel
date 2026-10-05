import { SetMetadata } from '@nestjs/common';

export const CHECK_POLICY_KEY = 'checkPolicy';

export type PolicyAction = 'read' | 'create' | 'update' | 'delete';

export interface CheckPolicyMetadata {
  /**
   * @description Resource type
   * @example "novel" or "chapter"
   */
  resource: string;
  /**
   * @description Action being performed
   */
  action: PolicyAction;
  /**
   * @default {'id'} - The resource's own id.
   * @example {'novelId'} - the resource's policy then knows to treat `resourceId` as the parent's id for that action (see `ChapterPolicy.isAllowed`'s `create` case).
   * @description GraphQL arg name `PoliciesGuard` reads as `resourceId`. Pass the parent's arg name for a `create` that has no id of its own yet.
   */
  idArg: string;
}

/**
 * @description
 * Decorator to mark a resolver/handler as requiring an ABAC policy check. `PoliciesGuard` reads this metadata, resolves `resourceId` from the configured `idArg`, and calls `IAuthorizationProvider.isAllowed()`, the resource's own `IResourcePolicy` decides what that id means and does any DB lookup needed.
 *
 * @throws
 * A misconfigured non-default `idArg` (arg name doesn't exist on the mutation) fails loudly. `PoliciesGuard` throws rather than silently checking against `'unknown'`.
 *
 * @example `@CheckPolicy('novel', 'read')`
 * @example `@CheckPolicy('chapter', 'create', 'novelId')`
 */
export const CheckPolicy = (
  resource: string,
  action: PolicyAction,
  idArg = 'id',
) =>
  SetMetadata(CHECK_POLICY_KEY, {
    resource,
    action,
    idArg,
  } satisfies CheckPolicyMetadata);

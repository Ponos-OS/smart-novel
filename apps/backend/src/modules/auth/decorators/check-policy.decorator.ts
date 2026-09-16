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
}

/**
 * @description
 * Decorator to mark a resolver/handler as requiring an ABAC policy check via the `IAuthorizationProvider`.
 * The `PoliciesGuard` reads this metadata and calls `IAuthorizationProvider.isAllowed()` with the resource context.
 *
 * A GraphQL arg literally named `id` is read as the resource's own id (`resourceId`) — the
 * usual case for `update`/`delete` on an existing resource. This decorator only carries a
 * coarse role/resource-type gate; a `create` action (no existing resource, so no `id` to
 * resolve) or any check that needs a specific field's value (e.g. "does this user own the
 * parent novel?") must be done explicitly in the resolver body, using its own already-typed
 * arguments — see `ChapterPolicy.canCreateInNovel` and `ChapterResolver.createChapter` for the
 * pattern. That check used to run through a generic `resourceAttributes` bag populated from an
 * untyped copy of the GraphQL args; it was removed because nothing tied the bag's key names to
 * the resolver's real `@Args(...)` names, so a rename on either side broke authorization
 * silently. Calling the policy method directly with a real, positionally-typed parameter has
 * no separate spelling to drift.
 *
 * @example `@CheckPolicy('novel', 'read')`
 */
export const CheckPolicy = (resource: string, action: PolicyAction) =>
  SetMetadata(CHECK_POLICY_KEY, {
    resource,
    action,
  } satisfies CheckPolicyMetadata);

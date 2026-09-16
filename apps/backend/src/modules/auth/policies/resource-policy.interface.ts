export interface ResourcePolicyCheckParams {
  userId: string;
  userRoles: string[];
  /**
   * @description The resource's own id, e.g. a chapter id for `chapter:update`.
   * `'unknown'` when the action has no existing resource to identify (e.g. `create`).
   */
  resourceId: string;
  action: string;
  /**
   * @description Extra attributes the policy needs but that aren't the resource's own id,
   * e.g. the parent novel's id for `chapter:create`. Populated by `@CheckPolicy()`'s
   * `extractResourceAttributes` for the mutation being guarded.
   */
  resourceAttributes?: Record<string, string>;
}

/**
 * @description
 * Per-resource-type permission check, registered by resource name in
 * `RbacAuthorizationProvider`. Adding a new resource type means adding a new
 * implementation and registering it — not editing a shared switch statement.
 */
export interface IResourcePolicy {
  isAllowed(params: ResourcePolicyCheckParams): Promise<boolean>;
}

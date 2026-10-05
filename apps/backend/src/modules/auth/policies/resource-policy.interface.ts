export interface ResourcePolicyCheckParams {
  /**
   * @example "234180127461293847"
   */
  userId: string;
  userRoles: string[];
  /**
   * @summary
   * CheckPolicy resolves the ID of the resource using this argument.
   * @description
   * Usually the resource's own id (e.g. a chapter id for `chapter:update`), but a `create` with no id of its own yet may configure `idArg` to a parent's id instead (e.g. a novel id for `chapter:create`).
   * Each policy's `isAllowed` documents what it expects per action. `'unknown'` when the default `id` arg wasn't present.
   */
  resourceId: string;
  action: string;
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

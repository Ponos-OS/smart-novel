import { SetMetadata } from '@nestjs/common';

export const CHECK_POLICY_KEY = 'checkPolicy';

export type PolicyAction = 'read' | 'create' | 'update' | 'delete';

export type ResourceAttributesExtractor<TArgs = any> = (
  args: TArgs,
) => Record<string, string>;

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
   * @description
   * Pulls exactly the GraphQL args a resource-specific check needs.
   *
   * Only what this returns reaches the policy as `resourceAttributes`.
   */
  extractResourceAttributes?: ResourceAttributesExtractor<any>;
}

/**
 * @description
 * Decorator to mark a resolver/handler as requiring an ABAC policy check via the `IAuthorizationProvider`.
 * The `PoliciesGuard` reads this metadata and calls `IAuthorizationProvider.isAllowed()` with the resource context.
 *
 * A GraphQL arg literally named `id` is read as the resource's own id (`resourceId`), this is usually the case for `update`/`delete` on an existing resource. For anything else the policy needs `extractResourceAttributes` to pull the identifier we should use for authorization explicitly from the args of the resolver.
 *
 * @example `@CheckPolicy('novel', 'read')`
 * @example `@CheckPolicy('chapter', 'create', (args: { novelId: string }) => ({ novelId: args.novelId }))`
 */
export const CheckPolicy = <TArgs = Record<string, unknown>>(
  resource: string,
  action: PolicyAction,
  extractResourceAttributes?: ResourceAttributesExtractor<TArgs>,
) =>
  SetMetadata(CHECK_POLICY_KEY, {
    resource,
    action,
    extractResourceAttributes,
  } satisfies CheckPolicyMetadata);

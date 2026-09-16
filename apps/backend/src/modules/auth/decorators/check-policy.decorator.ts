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
   * Pulls exactly the GraphQL args a resource-specific check needs, e.g. the parent's id for
   * a `create` mutation with no id of its own yet. Only what this returns reaches the policy
   * as `resourceAttributes` — nothing is collected implicitly.
   */
  extractResourceAttributes?: ResourceAttributesExtractor<any>;
}

/**
 * @description
 * Decorator to mark a resolver/handler as requiring an ABAC policy check via the `IAuthorizationProvider`.
 * The `PoliciesGuard` reads this metadata and calls `IAuthorizationProvider.isAllowed()` with the resource context.
 *
 * A GraphQL arg literally named `id` is read as the resource's own id (`resourceId`) — the
 * usual case for `update`/`delete` on an existing resource. For anything else the policy
 * needs (a `create` mutation with no id yet, or a check that depends on another arg), pass
 * `extractResourceAttributes` to pull it explicitly from the resolver's args.
 *
 * Note: `extractResourceAttributes` reads its input off the same untyped args object NestJS
 * builds from each `@Args(...)` decorator's string name — giving it a parameter type only
 * checks the extractor's own body, it can't verify that name still matches the resolver's
 * `@Args('...')` string if one of them is renamed later. Keep both spellings next to each
 * other (or share a constant) and rely on this resource/action's e2e permission-boundary test
 * to catch a drift, the same way `chapter.e2e-spec.ts` does for `createChapter`.
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

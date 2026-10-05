import { IAuthUser } from './auth-user.interface';

/**
 * @description Parameters for an authorization check.
 * Maps naturally to Cerbos, OPA, Cedar, or any ABAC engine.
 */
export interface AuthzCheckParams {
  /**
   * @description The authenticated user (principal)
   */
  principal: IAuthUser;
  /**
   * @description The resource type being accessed.
   * @example `novel` or `chapter`
   */
  resource: string;
  /**
   * @description The resource's unique identifier
   */
  resourceId: string;
  /**
   * @description The action being performed
   * @example `read` or `create`, `update`, `delete`
   */
  action: string;
}

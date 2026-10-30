import { Role } from '@smart-novel/shared';

/**
 * @description Provider-agnostic authenticated user representation.
 *
 * Normalized from whatever IdP token claims are available (ZITADEL, Keycloak, Auth0, Azure AD, etc.).
 */
export interface IAuthUser {
  /**
   * @description Subject identifier (unique user ID from the IdP)
   */
  sub: string;
  /**
   * @description User's full display name (e.g. "Admin User")
   */
  name: string;
  /**
   * @description User's given (first) name
   */
  givenName: string;
  /**
   * @description User's family (last) name
   */
  familyName: string;
  /**
   * @description User's preferred username / login name
   */
  preferredUsername: string;
  /**
   * @description User's email address
   */
  email: string;
  /**
   * @description Whether the email has been verified by the IdP
   */
  emailVerified: boolean;
  /**
   * @description Organization / tenant ID the user belongs to
   */
  orgId?: string;
  /**
   * @description Roles assigned to the user (project-scoped or global)
   */
  roles: Role[];
  /**
   * @description Arbitrary key-value metadata from the IdP
   */
  metadata: Record<string, string>;
}

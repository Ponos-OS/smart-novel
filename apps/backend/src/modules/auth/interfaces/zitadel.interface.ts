import type { JWTPayload } from 'jose';

import { Role } from '@smart-novel/shared';

export interface ZitadelOpenIdConfigurationResponse {
  issuer: string;
  jwks_uri: string;
  userinfo_endpoint: string;
}

/**
 * @description
 * OIDC response when we call `/oidc/v1/userinfo`.
 *
 * The actual claims depend on the scopes requested by the frontend during the Authorization Code flow. With the recommended scope string (`openid profile email urn:zitadel:iam:org:project:id:zitadel:aud urn:zitadel:iam:org:projects:roles urn:zitadel:iam:user:metadata`).
 */
export interface ZitadelUserInfoResponse {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  roles?: Role[];
  preferred_username?: string;
  /** @description Organization / tenant the user belongs to */
  'urn:zitadel:iam:org:id'?: string;
  /**
   * @description Project-scoped roles.
   * Shape: `{ "roleName": { "orgId": "orgDomain" } }`
   */
  'urn:zitadel:iam:org:project:roles'?: Record<
    string,
    Record<string, string>
  >;
  /** @description Base-64-encoded key→value metadata */
  'urn:zitadel:iam:user:metadata'?: Record<string, string>;
}

export interface ZitadelPatUserInfoResponse {
  /** @example "364554362883670018" */
  sub: string;
  updated_at?: number;
  name?: string;
  preferred_username?: string;
  /** @description Organization / tenant the user belongs to */
  'urn:zitadel:iam:user:resourceowner:id'?: string;
  /**
   * @description Project-scoped roles.
   * Shape: `{ "roleName": { "orgId": "orgDomain" } }`
   */
  'urn:zitadel:iam:user:resourceowner:name'?: 'ZITADEL';
  /** @description Base-64-encoded key→value metadata */
  'urn:zitadel:iam:user:resourceowner:primary_domain'?: Record<
    string,
    string
  >;
}

/**
 * @description
 * Response shape returned by `POST /auth/v1/usergrants/me/_search`.
 *
 * Used as a **fallback** to retrieve project roles when the standard UserInfo
 * endpoint does not include them (e.g. when the token is a PAT).
 */
export interface ZitadelUserGrantsResponse {
  result?: Array<{
    projectId: string;
    roles: string[];
    roleKeys: string[];
  }>;
}

export interface ZitadelJwtPayload extends JWTPayload {
  /** @example "http://localhost:8080" */
  iss: string;
  /** @example "364554362883670018" */
  sub: string;
  /**
   * @example
   * ```json
   * [
   *   "364554362732740610",
   *   "364554362682343426",
   *   "364554334932959234"
   * ]
   * ```
   */
  aud: string[];
  /** @example 1773839673 */
  exp: number;
  /** @example 1773796473 */
  iat: number;
  /** @example 1773796473 */
  auth_time: number;
  /** @example ["pwd"] */
  amr: string[];
  /** @example "364554362732740610" */
  azp: string;
  /** @example "364554362732740610" */
  client_id: string;
  /** @example "CLhcEcSNnBOBergGHtMHSA" */
  at_hash: string;
  /** @example "364569658990264322" */
  sid: string;
}

import { IAuthUser } from './auth-user.interface';

/**
 * @description Provider-agnostic interface for authentication (token validation).
 *
 * Implement this for ZITADEL, Keycloak, Auth0, Azure AD, etc.
 */
export interface IAuthProvider {
  /**
   * @description
   * Validate an access token (typically a JWT) and return the normalized user attributes.
   */
  validateToken(token: string): Promise<IAuthUser>;

  /**
   * @description
   * Verify a token was issued by us (valid signature, valid issuer) without regard to expiration.
   * For callers who received the token from a client that may present it well after `exp` (e.g. an
   * async worker that only picks up a job once its queue backlog clears). Throws if the signature is
   * invalid or the issuer doesn't match; resolves for an otherwise-valid token even if it's expired.
   */
  verifyIssuedByUs(token: string): Promise<void>;
}

export const AUTH_PROVIDER = Symbol('AUTH_PROVIDER');

const SAFE_KEY_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * @description
 * A token's `kid` comes from an unverified header, so it must not reach the logs as-is.
 */
export function sanitizeKeyId(keyId: unknown): string {
  return typeof keyId === 'string' && SAFE_KEY_ID.test(keyId)
    ? keyId
    : '<invalid>';
}

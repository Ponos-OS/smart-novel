import { createHash } from 'crypto';

export function generateUserInfoCacheKey(
  accessToken: string,
): string {
  const tokenHash = createHash('sha256')
    .update(accessToken)
    .digest('hex');
  const cacheKey = `auth:userinfo:${tokenHash}`;

  return cacheKey;
}

import { createHash } from 'crypto';

/**
 * @description Single source of truth for how chapter content is hashed.
 */
export function computeContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

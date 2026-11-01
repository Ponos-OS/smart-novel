/**
 * @description Prisma's `contains`, `startsWith` and `endsWith` hand the text to `LIKE` as is, so `%` and `_` in it would be wildcards.
 */
export function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, '\\$&');
}

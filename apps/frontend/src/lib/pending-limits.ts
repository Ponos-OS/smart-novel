/**
 * @description Limits whose rule is not in the Go schema yet, so `generated/limits.ts` cannot hold them. Each leaves this file when its feature reaches the backend: the cover ones in step 8.
 */
export const COVER_MAX_SIZE_BYTES = 5242880;
export const COVER_CONTENT_TYPE_EXTENSIONS: Readonly<
  Record<string, string>
> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

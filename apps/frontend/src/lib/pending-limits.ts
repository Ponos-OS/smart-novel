/**
 * @description Limits whose rule is not in the Go schema yet, so `generated/limits.ts` cannot hold them. Each leaves this file when its feature reaches the backend: the assistant one in step 7c, the cover ones in step 8.
 */
export const LICENSE_ASSISTANT_MESSAGE_MAX_LENGTH = 2000;
export const COVER_MAX_SIZE_BYTES = 5242880;
export const COVER_CONTENT_TYPE_EXTENSIONS: Readonly<
  Record<string, string>
> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

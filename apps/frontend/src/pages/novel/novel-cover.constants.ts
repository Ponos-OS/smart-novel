/** @description Same limits as the backend (`novel-cover.constants.ts`), checked here first so a bad file never costs a request. */
export const COVER_ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const COVER_MAX_SIZE_BYTES = 5 * 1024 * 1024;

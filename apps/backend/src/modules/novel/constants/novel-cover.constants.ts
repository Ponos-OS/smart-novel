/** @description Allowed cover image types and the extension their object key gets. */
export const COVER_CONTENT_TYPE_EXTENSIONS: Readonly<
  Record<string, string>
> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const COVER_MAX_SIZE_BYTES = 5 * 1024 * 1024;

export const COVER_OBJECT_KEY_PREFIX = 'covers';

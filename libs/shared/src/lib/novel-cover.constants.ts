/** @description Allowed cover image MIME types and the extension the backend gives their object key. */
export const COVER_CONTENT_TYPE_EXTENSIONS: Readonly<
  Record<string, string>
> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const COVER_MAX_SIZE_BYTES = 5 * 1024 * 1024;

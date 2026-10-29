import { join } from 'path';

export const PLATFORM_TERMS = Symbol('PLATFORM_TERMS');

/** @description Copied next to the bundle by the `assets` option of `webpack.config.js`. */
export const PLATFORM_TERMS_FILE_PATH = join(
  __dirname,
  'assets',
  'platform-terms.md',
);

export const ACCEPTED_CACHE_TTL_SECONDS = 24 * 60 * 60;

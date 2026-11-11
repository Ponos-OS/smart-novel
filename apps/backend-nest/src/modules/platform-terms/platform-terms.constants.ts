import { join } from 'path';

export const PLATFORM_TERMS = Symbol('PLATFORM_TERMS');

export const PLATFORM_TERMS_FILE_PATH = join(
  __dirname,
  'platform-terms.md',
);

export const ACCEPTED_CACHE_TTL_SECONDS = 24 * 60 * 60;

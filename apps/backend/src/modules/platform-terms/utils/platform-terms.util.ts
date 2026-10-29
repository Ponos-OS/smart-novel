import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import matter from 'gray-matter';

import { PlatformTerms } from '../types';

export function parsePlatformTerms(source: string): PlatformTerms {
  const { data, content } = matter(source);
  const markdown = content.trim();

  if (!Number.isInteger(data.version) || data.version < 1) {
    throw new Error(
      `Platform terms frontmatter needs a positive integer "version", got ${JSON.stringify(data.version)}`,
    );
  }
  if (!markdown) {
    throw new Error('Platform terms have no text');
  }

  return { version: data.version, markdown };
}

export function loadPlatformTerms(filePath: string): PlatformTerms {
  return parsePlatformTerms(readFileSync(filePath, 'utf-8'));
}

export function computePlatformTermsHash(markdown: string): string {
  return createHash('sha256')
    .update(markdown.replace(/\r\n?/g, '\n').trim())
    .digest('hex');
}

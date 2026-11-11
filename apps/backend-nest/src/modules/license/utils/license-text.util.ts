import { createHash } from 'crypto';

export function normalizeLicenseText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

export function computeLicenseTextHash(text: string): string {
  return createHash('sha256')
    .update(normalizeLicenseText(text))
    .digest('hex');
}

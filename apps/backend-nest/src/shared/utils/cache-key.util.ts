import { createHash } from 'crypto';

/**
 * @description
 * Normalizes paragraph text for consistent cache key generation.
 */
export function normalizeParagraph(text: string): string {
  return text
    .replace(/\s+/g, ' ') // Collapse multiple whitespace to single space
    .trim() // Remove leading/trailing whitespace
    .toLowerCase(); // Lowercase for case-insensitive matching
}

/**
 * @description
 * Generates a SHA-256 fingerprint of normalized paragraph text. This creates a stable, content-based hash for cache keys.
 */
export function generateParagraphFingerprint(text: string): string {
  const normalized = normalizeParagraph(text);

  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * @description
 * Generates a canonical cache key from word and context. This design maximizes cache hit rates while preventing wrong answers:
 *
 * - Word normalization handles case variations.
 * - Paragraph fingerprint ensures context stability.
 * - Hash-based approach is resilient to whitespace differences.
 */
export function generateCacheKey(
  word: string,
  context: string,
): string {
  const wordLower = word.toLowerCase().trim();
  const fingerprint = generateParagraphFingerprint(context);

  return `explain:${wordLower}:${fingerprint}`;
}

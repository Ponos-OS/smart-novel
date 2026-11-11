import {
  generateCacheKey,
  generateParagraphFingerprint,
  normalizeParagraph,
} from './cache-key.util';

describe(normalizeParagraph.name, () => {
  it('should collapse whitespace, trim text, and lowercase text', () => {
    const result = normalizeParagraph(
      '  Hello\n\t  WORLD   from   Jest  ',
    );

    expect(result).toBe('hello world from jest');
  });

  it('should return empty string for whitespace-only input', () => {
    const result = normalizeParagraph('   \n\t   ');

    expect(result).toBe('');
  });
});

describe(generateParagraphFingerprint.name, () => {
  it('should generate same fingerprint for semantically equivalent whitespace/case variants', () => {
    const first = '  The QUICK\n brown\tfox  ';
    const second = 'the quick brown fox';

    const result = generateParagraphFingerprint(first);

    expect(result).toBe(generateParagraphFingerprint(second));
  });

  it('should generate different fingerprints for different normalized content', () => {
    const first = 'the quick brown fox';
    const second = 'the quick brown fox jumps';

    const result = generateParagraphFingerprint(first);

    expect(result).not.toBe(generateParagraphFingerprint(second));
  });

  it('should return a valid SHA-256 hex digest', () => {
    const fingerprint =
      generateParagraphFingerprint('some paragraph');

    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe(generateCacheKey.name, () => {
  it('should build key in explain:<word>:<fingerprint> format with normalized word', () => {
    const key = generateCacheKey('  TeStWoRd  ', 'Context paragraph');

    expect(key).toMatch(/^explain:testword:[a-f0-9]{64}$/);
  });

  it('should use normalized context for stable cache keys', () => {
    const keyOne = generateCacheKey('Word', '  Some\n\tContext  ');
    const keyTwo = generateCacheKey(' word ', 'some context');

    expect(keyOne).toBe(keyTwo);
  });
});

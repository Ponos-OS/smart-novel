import { join } from 'path';

import {
  computePlatformTermsHash,
  loadPlatformTerms,
  parsePlatformTerms,
} from './platform-terms.util';

describe(parsePlatformTerms.name, () => {
  it('should read the version and the trimmed markdown', () => {
    const source =
      '---\nversion: 3\n---\n\n# Platform License\n\nText.\n';

    const result = parsePlatformTerms(source);

    expect(result).toEqual({
      version: 3,
      markdown: '# Platform License\n\nText.',
    });
  });

  it.each([
    ['a missing version', '---\ntitle: x\n---\n# Terms'],
    ['no frontmatter', '# Terms'],
    ['a non-integer version', '---\nversion: 1.5\n---\n# Terms'],
    ['a string version', '---\nversion: "1"\n---\n# Terms'],
    ['a zero version', '---\nversion: 0\n---\n# Terms'],
  ])('should fail on %s', (_, source) => {
    const act = () => parsePlatformTerms(source);

    expect(act).toThrow('positive integer "version"');
  });

  it('should fail on empty text', () => {
    const act = () =>
      parsePlatformTerms('---\nversion: 1\n---\n  \n');

    expect(act).toThrow('no text');
  });
});

describe(loadPlatformTerms.name, () => {
  it('should load the terms shipped with the backend', () => {
    const result = loadPlatformTerms(
      join(__dirname, '..', 'platform-terms.md'),
    );

    expect(result.version).toBeGreaterThanOrEqual(1);
    expect(result.markdown).toStartWith('# Platform License');
  });

  it('should fail on a missing file', () => {
    const act = () => loadPlatformTerms('/nowhere/platform-terms.md');

    expect(act).toThrow('ENOENT');
  });
});

describe(computePlatformTermsHash.name, () => {
  it('should ignore line endings and surrounding blank lines', () => {
    const unix = '# Terms\n\nText.';
    const windows = '\r\n# Terms\r\n\r\nText.\r\n';

    const unixHash = computePlatformTermsHash(unix);
    const windowsHash = computePlatformTermsHash(windows);

    expect(unixHash).toBe(windowsHash);
  });
});

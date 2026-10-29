import { join } from 'path';

import { computePlatformTermsHash, loadPlatformTerms } from './utils';

/**
 * @description Editing `platform-terms.md` without bumping its `version` would change what writers already accepted. Bump the version in the file, then add the new version and the printed hash here, keeping the old ones.
 */
const HASH_BY_VERSION: Record<number, string> = {
  1: '82661bf0afbcbd3b8f6827fe11c08c79be025e9feab870f86e1b0d30c624c446',
};

describe('platform-terms.md', () => {
  it('should not change its text without a version bump', () => {
    const { version, markdown } = loadPlatformTerms(
      join(__dirname, 'platform-terms.md'),
    );

    const hash = computePlatformTermsHash(markdown);

    expect(HASH_BY_VERSION[version]).toBe(hash);
  });
});

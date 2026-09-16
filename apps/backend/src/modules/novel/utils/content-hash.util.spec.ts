import { computeContentHash } from './content-hash.util';

describe(computeContentHash.name, () => {
  it('should hash content using sha256', () => {
    const content = 'Hello, World!';

    const hash = computeContentHash(content);

    expect(hash).toBe(
      'dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f',
    );
  });
});

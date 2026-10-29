import {
  computeLicenseTextHash,
  normalizeLicenseText,
} from './license-text.util';

describe(normalizeLicenseText.name, () => {
  it.each([
    ['windows line endings', 'Attribution 4.0\r\nInternational\r\n'],
    ['old mac line endings', 'Attribution 4.0\rInternational\r'],
    [
      'trailing whitespace',
      'Attribution 4.0  \t\nInternational \n\n',
    ],
    [
      'surrounding blank lines',
      '\n\nAttribution 4.0\nInternational\n\n',
    ],
  ])('should normalize %s', (_, text) => {
    const result = normalizeLicenseText(text);

    expect(result).toBe('Attribution 4.0\nInternational');
  });

  it('should keep inner indentation', () => {
    const text = 'Section 1.\n  (a) Definitions.';

    const result = normalizeLicenseText(text);

    expect(result).toBe(text);
  });
});

describe(computeLicenseTextHash.name, () => {
  it('should give the same hash to texts that differ only in whitespace noise', () => {
    const unix = 'Attribution 4.0 International\n';
    const windows = 'Attribution 4.0 International  \r\n\r\n';

    const unixHash = computeLicenseTextHash(unix);
    const windowsHash = computeLicenseTextHash(windows);

    expect(unixHash).toBe(windowsHash);
    expect(unixHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should give different hashes to different texts', () => {
    const attribution = 'Attribution 4.0 International';
    const nonCommercial =
      'Attribution-NonCommercial 4.0 International';

    const attributionHash = computeLicenseTextHash(attribution);
    const nonCommercialHash = computeLicenseTextHash(nonCommercial);

    expect(attributionHash).not.toBe(nonCommercialHash);
  });
});

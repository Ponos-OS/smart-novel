import { LicenseSourceType } from '../../generated/graphql';
import { getLicenseNotice } from './license-notice';

describe(getLicenseNotice.name, () => {
  it.each([
    [LicenseSourceType.Canonical, 'Canonical license CC-BY-4.0'],
    [
      LicenseSourceType.Forked,
      'Modified from CC-BY-4.0 - not the same as the canonical license',
    ],
    [
      LicenseSourceType.Custom,
      'Custom license - review with a lawyer.',
    ],
  ])('words a %s license as "%s"', (sourceType, expected) => {
    // Arrange
    const license = {
      id: '3f7b0c1e-6d52-4b8a-9a41-5c2e8d7f1a06',
      name: 'CC BY 4.0',
      sourceType,
      canonicalId: 'CC-BY-4.0',
      text: 'Attribution 4.0 International',
    };

    // Act
    const result = getLicenseNotice(license);

    // Assert
    expect(result).toBe(expected);
  });
});

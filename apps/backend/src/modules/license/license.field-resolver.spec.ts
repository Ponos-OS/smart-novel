import { LicenseSourceType } from '@prisma/client';

import type { CanonicalLicenseCatalog } from '../fithara';
import type { License } from './types';

import { LicenseFieldResolver } from './license.field-resolver';

describe(LicenseFieldResolver.name, () => {
  let uut: LicenseFieldResolver;
  let catalog: CanonicalLicenseCatalog;

  const license: License = {
    id: '3f7b0c1e-6d52-4b8a-9a41-5c2e8d7f1a06',
    name: 'CC BY 4.0',
    text: 'Attribution 4.0 International',
    sourceType: LicenseSourceType.CANONICAL,
    canonicalId: 'CC-BY-4.0',
  };

  beforeEach(() => {
    catalog = {
      getOfficialUrl: vi
        .fn()
        .mockResolvedValue(
          'https://creativecommons.org/licenses/by/4.0/legalcode',
        ),
    } as any;

    uut = new LicenseFieldResolver(catalog);
  });

  it('should link a canonical or forked license to the text it is, or was modified from', async () => {
    const result = await uut.officialUrl(license);

    expect(result).toBe(
      'https://creativecommons.org/licenses/by/4.0/legalcode',
    );
    expect(catalog.getOfficialUrl).toHaveBeenCalledWith('CC-BY-4.0');
  });

  it('should have no link for a custom license and not ask the registry', async () => {
    const result = await uut.officialUrl({
      ...license,
      sourceType: LicenseSourceType.CUSTOM,
      canonicalId: null,
    });

    expect(result).toBeNull();
    expect(catalog.getOfficialUrl).not.toHaveBeenCalled();
  });
});

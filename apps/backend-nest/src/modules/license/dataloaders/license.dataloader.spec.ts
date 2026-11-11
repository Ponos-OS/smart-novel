import { LicenseSourceType } from '@prisma/client';

import type { LicenseService } from '../services';

import { LicenseDataLoader } from './license.dataloader';

describe(LicenseDataLoader.name, () => {
  let uut: LicenseDataLoader;
  let licenseService: LicenseService;

  const ccBy = {
    id: '3f7b0c1e-6d52-4b8a-9a41-5c2e8d7f1a06',
    name: 'CC BY 4.0',
    text: 'Attribution 4.0 International',
    sourceType: LicenseSourceType.CANONICAL,
    canonicalId: 'CC-BY-4.0',
  };
  const custom = {
    id: 'b2d9c4aa-18f3-4f0e-9c57-3a6d1e8b7f42',
    name: 'My terms',
    text: 'You may read this novel for free.',
    sourceType: LicenseSourceType.CUSTOM,
    canonicalId: null,
  };

  beforeEach(() => {
    licenseService = { findByIds: vi.fn() } as any;
    uut = new LicenseDataLoader(licenseService);
  });

  it('fetches the licenses of concurrent loads in one batch, once per distinct id', async () => {
    // Arrange
    vi.mocked(licenseService.findByIds).mockResolvedValue(
      new Map([
        [ccBy.id, ccBy],
        [custom.id, custom],
      ]) as any,
    );

    // Act
    const result = await Promise.all([
      uut.load(ccBy.id),
      uut.load(custom.id),
      uut.load(ccBy.id),
    ]);

    // Assert
    expect(result).toEqual([ccBy, custom, ccBy]);
    expect(licenseService.findByIds).toHaveBeenCalledExactlyOnceWith([
      ccBy.id,
      custom.id,
    ]);
  });

  it('rejects for an id that has no license', async () => {
    // Arrange
    vi.mocked(licenseService.findByIds).mockResolvedValue(new Map());

    // Act
    const promise = uut.load(ccBy.id);

    // Assert
    await expect(promise).rejects.toThrow(
      `License with id ${ccBy.id} not found`,
    );
  });
});

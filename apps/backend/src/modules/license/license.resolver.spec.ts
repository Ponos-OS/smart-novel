import { LicenseSourceType } from '@prisma/client';

import type { LicenseDraftInput } from './inputs';
import type { LicenseService } from './services';

import { LicenseResolver } from './license.resolver';

describe(LicenseResolver.name, () => {
  let uut: LicenseResolver;
  let licenseService: LicenseService;

  beforeEach(() => {
    licenseService = { getOrCreate: vi.fn() } as any;

    uut = new LicenseResolver(licenseService);
  });

  describe('createLicense', () => {
    it('should store the text as a shared license', async () => {
      const input = {
        title: 'Read it, do not copy it',
        text: 'You may read this novel. You may not copy it.',
        source: { type: LicenseSourceType.CUSTOM },
      } satisfies LicenseDraftInput;
      const stored = {
        id: 'b2d9c4aa-18f3-4f0e-9c57-3a6d1e8b7f42',
        ownerId: 'system',
      };
      vi.mocked(licenseService.getOrCreate).mockResolvedValue(
        stored as any,
      );

      const result = await uut.createLicense(input);

      expect(result).toBe(stored);
      expect(licenseService.getOrCreate).toHaveBeenCalledWith(
        input,
        'system',
      );
    });
  });
});

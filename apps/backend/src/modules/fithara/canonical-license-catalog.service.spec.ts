import type { CustomLoggerService } from 'nestjs-backend-common';

import { ServiceUnavailableException } from '@nestjs/common';

import {
  type FitharaClient,
  FitharaRequestError,
} from '../../shared';
import { CanonicalLicenseCatalog } from './canonical-license-catalog.service';

describe(CanonicalLicenseCatalog.name, () => {
  let uut: CanonicalLicenseCatalog;
  let fithara: FitharaClient;
  let logger: CustomLoggerService;

  const licenses = [
    {
      id: 'CC-BY-4.0',
      officialUrl:
        'https://creativecommons.org/licenses/by/4.0/legalcode',
    },
    {
      id: 'CC-BY-NC-4.0',
      officialUrl:
        'https://creativecommons.org/licenses/by-nc/4.0/legalcode',
    },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
    fithara = {
      getLicense: vi.fn(),
      listLicenses: vi.fn().mockResolvedValue({ licenses }),
      draft: vi.fn(),
    } as any;
    logger = { warn: vi.fn() } as any;

    uut = new CanonicalLicenseCatalog(fithara, logger);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('findVerbatim', () => {
    it('should return the license of the registry', async () => {
      const license = {
        id: 'CC-BY-4.0',
        shortName: 'CC BY 4.0',
        body: 'Attribution 4.0 International',
      };
      vi.mocked(fithara.getLicense).mockResolvedValue(license as any);

      const result = await uut.findVerbatim('CC-BY-4.0');

      expect(result).toBe(license);
      expect(fithara.getLicense).toHaveBeenCalledWith('CC-BY-4.0');
    });

    it.each(['UNKNOWN_LICENSE', 'LICENSE_INACTIVE'] as const)(
      'should return null for %s',
      async (code) => {
        vi.mocked(fithara.getLicense).mockRejectedValue(
          new FitharaRequestError('nope', 404, code),
        );

        const result = await uut.findVerbatim('MIT-0');

        expect(result).toBeNull();
      },
    );

    it('should not guess when Fithara cannot be reached', async () => {
      vi.mocked(fithara.getLicense).mockRejectedValue(
        new FitharaRequestError(
          'Could not reach Fithara: fetch failed',
        ),
      );

      const result = uut.findVerbatim('CC-BY-4.0');

      await expect(result).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(logger.warn).toHaveBeenCalledOnce();
    });
  });

  describe('getOfficialUrl', () => {
    it('should return the link of a known license and null of an unknown one', async () => {
      const known = await uut.getOfficialUrl('CC-BY-NC-4.0');
      const unknown = await uut.getOfficialUrl('MIT-0');

      expect(known).toBe(
        'https://creativecommons.org/licenses/by-nc/4.0/legalcode',
      );
      expect(unknown).toBeNull();
    });

    it('should list the registry once per hour, however many licenses ask', async () => {
      await Promise.all([
        uut.getOfficialUrl('CC-BY-4.0'),
        uut.getOfficialUrl('CC-BY-NC-4.0'),
      ]);
      await uut.getOfficialUrl('CC-BY-4.0');
      vi.advanceTimersByTime(60 * 60 * 1000 + 1);
      await uut.getOfficialUrl('CC-BY-4.0');

      expect(fithara.listLicenses).toHaveBeenCalledTimes(2);
    });

    it('should give null, not an error, when the registry cannot be reached, and ask again next time', async () => {
      vi.mocked(fithara.listLicenses)
        .mockRejectedValueOnce(new FitharaRequestError('down'))
        .mockResolvedValueOnce({ licenses } as any);

      const failed = await uut.getOfficialUrl('CC-BY-4.0');
      const recovered = await uut.getOfficialUrl('CC-BY-4.0');

      expect(failed).toBeNull();
      expect(recovered).toBe(
        'https://creativecommons.org/licenses/by/4.0/legalcode',
      );
      expect(logger.warn).toHaveBeenCalledOnce();
    });
  });
});

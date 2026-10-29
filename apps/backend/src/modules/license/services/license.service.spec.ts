import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { LicenseSourceType } from '@prisma/client';

import type { PrismaService } from '../../prisma';
import type { LicenseDraftInput } from '../inputs';

import { computeLicenseTextHash } from '../utils';
import { LicenseService } from './license.service';

describe(LicenseService.name, () => {
  let uut: LicenseService;
  let prisma: PrismaService;

  const ccBy = {
    id: '3f7b0c1e-6d52-4b8a-9a41-5c2e8d7f1a06',
    name: 'CC BY 4.0',
    text: 'Attribution 4.0 International\n\n=====\n',
    sourceType: LicenseSourceType.CANONICAL,
    canonicalId: 'CC-BY-4.0',
    isDefault: true,
  };
  const noResale = {
    title: 'CC BY 4.0 without resale',
    text: 'Attribution 4.0 International\r\n\r\nNo resale.  \r\n',
    source: {
      type: LicenseSourceType.FORKED,
      canonicalId: 'CC-BY-4.0',
    },
  } satisfies LicenseDraftInput;

  beforeEach(() => {
    prisma = {
      license: {
        findFirstOrThrow: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        createMany: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      $executeRaw: vi.fn(),
      $transaction: vi.fn((callback) => callback(prisma)),
    } as any;

    uut = new LicenseService(prisma);
  });

  describe('getDefault', () => {
    it('should look up the license flagged as default', async () => {
      vi.mocked(prisma.license.findFirstOrThrow).mockResolvedValue(
        ccBy as any,
      );

      const result = await uut.getDefault();

      expect(result).toBe(ccBy);
      expect(prisma.license.findFirstOrThrow).toHaveBeenCalledWith({
        where: { isDefault: true },
      });
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException when the license does not exist', async () => {
      vi.mocked(prisma.license.findUnique).mockResolvedValue(null);

      const result = uut.findOne(ccBy.id);

      await expect(result).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByIds', () => {
    it('should return the stored licenses keyed by id, skipping unknown ids', async () => {
      vi.mocked(prisma.license.findMany).mockResolvedValue([
        ccBy as any,
      ]);

      const result = await uut.findByIds([
        ccBy.id,
        'b2d9c4aa-18f3-4f0e-9c57-3a6d1e8b7f42',
      ]);

      expect(result).toEqual(new Map([[ccBy.id, ccBy]]));
      expect(prisma.license.findMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: [ccBy.id, 'b2d9c4aa-18f3-4f0e-9c57-3a6d1e8b7f42'],
          },
        },
      });
    });
  });

  describe('getOrCreate', () => {
    it('should reuse the stored row when the same text was stored before, whatever its whitespace', async () => {
      vi.mocked(prisma.license.findUnique).mockResolvedValue(
        ccBy as any,
      );

      const result = await uut.getOrCreate({
        title: 'My own name for it',
        text: `${ccBy.text.replace(/\n/g, '\r\n')}   \r\n`,
        source: { type: LicenseSourceType.CUSTOM },
      });

      expect(result).toBe(ccBy);
      expect(prisma.license.findUnique).toHaveBeenCalledWith({
        where: { textHash: computeLicenseTextHash(ccBy.text) },
      });
      expect(prisma.license.createMany).not.toHaveBeenCalled();
    });

    it('should store a new text normalized, with the hash used to dedupe it', async () => {
      vi.mocked(prisma.license.findUnique).mockResolvedValue(null);
      const stored = { id: '9d1c5e7a-2b3f-4a60-8c91-0e2d4f6a8b10' };
      vi.mocked(prisma.license.findUniqueOrThrow).mockResolvedValue(
        stored as any,
      );
      const textHash = computeLicenseTextHash(noResale.text);

      const result = await uut.getOrCreate(noResale);

      expect(result).toBe(stored);
      expect(prisma.license.createMany).toHaveBeenCalledWith({
        data: [
          {
            name: 'CC BY 4.0 without resale',
            text: 'Attribution 4.0 International\n\nNo resale.',
            textHash,
            sourceType: LicenseSourceType.FORKED,
            canonicalId: 'CC-BY-4.0',
          },
        ],
        skipDuplicates: true,
      });
    });

    it('should store a custom license without a canonicalId', async () => {
      vi.mocked(prisma.license.findUnique).mockResolvedValue(null);

      await uut.getOrCreate({
        title: 'Read it, do not copy it',
        text: 'You may read this novel. You may not copy it.',
        source: { type: LicenseSourceType.CUSTOM },
      });

      expect(prisma.license.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [
            expect.objectContaining({
              sourceType: LicenseSourceType.CUSTOM,
              canonicalId: null,
            }),
          ],
        }),
      );
    });

    it.each([
      [
        'an unknown text claiming to be canonical',
        {
          type: LicenseSourceType.CANONICAL,
          canonicalId: 'CC-BY-4.0',
        },
      ],
      [
        'a forked text without its base',
        { type: LicenseSourceType.FORKED },
      ],
      [
        'a custom text with a base',
        { type: LicenseSourceType.CUSTOM, canonicalId: 'CC-BY-4.0' },
      ],
    ])('should reject %s', async (_, source) => {
      vi.mocked(prisma.license.findUnique).mockResolvedValue(null);

      const result = uut.getOrCreate({ ...noResale, source });

      await expect(result).rejects.toThrow(BadRequestException);
      expect(prisma.license.createMany).not.toHaveBeenCalled();
    });
  });

  describe('resolve', () => {
    it('should return undefined when nothing was selected', async () => {
      const result = await uut.resolve({});

      expect(result).toBeUndefined();
    });

    it('should load the license by id', async () => {
      vi.mocked(prisma.license.findUnique).mockResolvedValue(
        ccBy as any,
      );

      const result = await uut.resolve({ licenseId: ccBy.id });

      expect(result).toBe(ccBy);
    });

    it('should reject a selection with both an id and a draft', async () => {
      const result = uut.resolve({
        licenseId: ccBy.id,
        licenseDraft: noResale,
      });

      await expect(result).rejects.toThrow(BadRequestException);
    });
  });

  describe('setDefault', () => {
    it('should make the selected license the only default inside one locked transaction', async () => {
      vi.mocked(prisma.license.findUnique).mockResolvedValue(
        ccBy as any,
      );
      vi.mocked(prisma.license.update).mockResolvedValue({
        ...ccBy,
        isDefault: true,
      } as any);

      const result = await uut.setDefault({ licenseId: ccBy.id });

      expect(result.isDefault).toBeTrue();
      expect(prisma.$executeRaw).toHaveBeenCalledBefore(
        vi.mocked(prisma.license.updateMany),
      );
      expect(prisma.license.updateMany).toHaveBeenCalledWith({
        where: { isDefault: true, id: { not: ccBy.id } },
        data: { isDefault: false },
      });
      expect(prisma.license.update).toHaveBeenCalledWith({
        where: { id: ccBy.id },
        data: { isDefault: true },
      });
    });

    it('should reject a call that selects nothing', async () => {
      const result = uut.setDefault({});

      await expect(result).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});

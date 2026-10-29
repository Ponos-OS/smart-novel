import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { LicenseSourceType } from '@prisma/client';

import type { CanonicalLicenseCatalog } from '../../fithara';
import type { PrismaService } from '../../prisma';
import type { LicenseDraftInput } from '../inputs';

import { computeLicenseTextHash } from '../utils';
import { LicenseService } from './license.service';

describe(LicenseService.name, () => {
  let uut: LicenseService;
  let prisma: PrismaService;
  let catalog: CanonicalLicenseCatalog;

  const writerId = '230104087265432001';
  const otherWriterId = '260311094522198751';

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
        findFirst: vi.fn(),
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

    catalog = { findVerbatim: vi.fn() } as any;

    uut = new LicenseService(prisma, catalog);
  });

  describe('getDefault', () => {
    it('should look up the license flagged as default', async () => {
      vi.mocked(prisma.license.findFirstOrThrow).mockResolvedValue(
        ccBy as any,
      );

      const result = await uut.getDefault();

      expect(result).toBe(ccBy);
      expect(prisma.license.findFirstOrThrow).toHaveBeenCalledWith({
        where: { isDefault: true, isDraft: false },
      });
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
          isDraft: false,
        },
      });
    });
  });

  describe('getOrCreate', () => {
    it('should reuse the shared row when the same text is stored, whatever its whitespace', async () => {
      vi.mocked(prisma.license.findUnique).mockResolvedValue(
        ccBy as any,
      );

      const result = await uut.getOrCreate(
        {
          title: 'My own name for it',
          text: `${ccBy.text.replace(/\n/g, '\r\n')}   \r\n`,
          source: { type: LicenseSourceType.CUSTOM },
        },
        writerId,
      );

      expect(result).toBe(ccBy);
      expect(prisma.license.findUnique).toHaveBeenCalledWith({
        where: {
          ownerId_textHash: {
            ownerId: 'system',
            textHash: computeLicenseTextHash(ccBy.text),
          },
        },
      });
      expect(prisma.license.createMany).not.toHaveBeenCalled();
    });

    it('should not hand a writer a second copy of a license they already have', async () => {
      const own = { id: '9d1c5e7a-2b3f-4a60-8c91-0e2d4f6a8b10' };
      vi.mocked(prisma.license.findUnique)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(own as any);

      const result = await uut.getOrCreate(noResale, writerId);

      expect(result).toBe(own);
      expect(prisma.license.findUnique).toHaveBeenLastCalledWith({
        where: {
          ownerId_textHash: {
            ownerId: writerId,
            textHash: computeLicenseTextHash(noResale.text),
          },
        },
      });
      expect(prisma.license.createMany).not.toHaveBeenCalled();
    });

    it("should give another writer their own row for the same text, never the first writer's", async () => {
      vi.mocked(prisma.license.findUnique).mockResolvedValue(null);

      await uut.getOrCreate(noResale, otherWriterId);

      const looked = vi
        .mocked(prisma.license.findUnique)
        .mock.calls.map(
          ([args]) => (args as any).where.ownerId_textHash.ownerId,
        );
      expect(looked).toEqual(['system', otherWriterId]);
      expect(prisma.license.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ ownerId: otherWriterId })],
        skipDuplicates: true,
      });
    });

    it('should store a new text normalized, with the hash used to dedupe it', async () => {
      vi.mocked(prisma.license.findUnique).mockResolvedValue(null);
      const stored = { id: '9d1c5e7a-2b3f-4a60-8c91-0e2d4f6a8b10' };
      vi.mocked(prisma.license.findUniqueOrThrow).mockResolvedValue(
        stored as any,
      );
      const textHash = computeLicenseTextHash(noResale.text);

      const result = await uut.getOrCreate(noResale, writerId);

      expect(result).toBe(stored);
      expect(prisma.license.createMany).toHaveBeenCalledWith({
        data: [
          {
            name: 'CC BY 4.0 without resale',
            text: 'Attribution 4.0 International\n\nNo resale.',
            textHash,
            ownerId: writerId,
            sourceType: LicenseSourceType.FORKED,
            canonicalId: 'CC-BY-4.0',
          },
        ],
        skipDuplicates: true,
      });
    });

    it('should store a custom license without a canonicalId', async () => {
      vi.mocked(prisma.license.findUnique).mockResolvedValue(null);

      await uut.getOrCreate(
        {
          title: 'Read it, do not copy it',
          text: 'You may read this novel. You may not copy it.',
          source: { type: LicenseSourceType.CUSTOM },
        },
        writerId,
      );

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
        'a canonical text without its canonicalId',
        { type: LicenseSourceType.CANONICAL },
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

      const result = uut.getOrCreate(
        { ...noResale, source },
        writerId,
      );

      await expect(result).rejects.toThrow(BadRequestException);
      expect(prisma.license.createMany).not.toHaveBeenCalled();
    });
  });

  describe('prepareNew', () => {
    it.each([
      ['a blank name', { ...noResale, title: '   ' }],
      ['a blank text', { ...noResale, text: ' \r\n ' }],
    ])(
      'should refuse %s before asking the database anything',
      async (_, draft) => {
        const result = uut.prepareNew(draft, writerId);

        await expect(result).rejects.toThrow(
          'needs a name and a text',
        );
        expect(prisma.license.findUnique).not.toHaveBeenCalled();
      },
    );

    it('should hand back what to create, or the stored license with the same text', async () => {
      vi.mocked(prisma.license.findUnique)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(ccBy as any);

      const fresh = await uut.prepareNew(noResale, writerId);
      const known = await uut.prepareNew(noResale, writerId);

      expect(fresh).toEqual({
        create: expect.objectContaining({
          name: 'CC BY 4.0 without resale',
          sourceType: LicenseSourceType.FORKED,
        }),
      });
      expect(known).toEqual({ existing: ccBy });
    });
  });

  describe('getOrCreate with a canonical claim', () => {
    const ccByNc = {
      id: 'CC-BY-NC-4.0',
      shortName: 'CC BY-NC 4.0',
      body: 'Attribution-NonCommercial 4.0 International\n\n=====\n',
    };
    const claim = {
      title:
        'Creative Commons Attribution-NonCommercial 4.0 International',
      text: ccByNc.body.replace(/\n/g, '\r\n'),
      source: {
        type: LicenseSourceType.CANONICAL,
        canonicalId: 'CC-BY-NC-4.0',
      },
    } satisfies LicenseDraftInput;

    beforeEach(() => {
      vi.mocked(prisma.license.findUnique).mockResolvedValue(null);
    });

    it('should store the text as canonical, under the name of the registry, when it is the registry text word for word', async () => {
      vi.mocked(catalog.findVerbatim).mockResolvedValue(ccByNc);

      await uut.getOrCreate(claim, writerId);

      expect(catalog.findVerbatim).toHaveBeenCalledWith(
        'CC-BY-NC-4.0',
      );
      expect(prisma.license.createMany).toHaveBeenCalledWith({
        data: [
          {
            name: 'CC BY-NC 4.0',
            text: 'Attribution-NonCommercial 4.0 International\n\n=====',
            textHash: computeLicenseTextHash(ccByNc.body),
            ownerId: 'system',
            sourceType: LicenseSourceType.CANONICAL,
            canonicalId: 'CC-BY-NC-4.0',
          },
        ],
        skipDuplicates: true,
      });
    });

    it.each([
      ['a text that differs from the registry', ccByNc],
      ['a license the registry does not know', null],
    ])('should reject %s', async (_, found) => {
      vi.mocked(catalog.findVerbatim).mockResolvedValue(
        found && {
          ...found,
          body: `${found.body}But you may sell it.`,
        },
      );

      const result = uut.getOrCreate(claim, writerId);

      await expect(result).rejects.toThrow(
        'is not the canonical license CC-BY-NC-4.0',
      );
      expect(prisma.license.createMany).not.toHaveBeenCalled();
    });

    it('should not take a text as canonical when the registry cannot be asked', async () => {
      vi.mocked(catalog.findVerbatim).mockRejectedValue(
        new ServiceUnavailableException(),
      );

      const result = uut.getOrCreate(claim, writerId);

      await expect(result).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(prisma.license.createMany).not.toHaveBeenCalled();
    });

    it('should not ask the registry about a text that is already stored', async () => {
      vi.mocked(prisma.license.findUnique).mockResolvedValue(
        ccBy as any,
      );

      const result = await uut.getOrCreate(claim, writerId);

      expect(result).toBe(ccBy);
      expect(catalog.findVerbatim).not.toHaveBeenCalled();
    });
  });

  describe('resolve', () => {
    it('should return undefined when nothing was selected', async () => {
      const result = await uut.resolve({}, writerId);

      expect(result).toBeUndefined();
    });

    it('should load the license by id', async () => {
      vi.mocked(prisma.license.findFirst).mockResolvedValue(
        ccBy as any,
      );

      const result = await uut.resolve(
        { licenseId: ccBy.id },
        writerId,
      );

      expect(result).toBe(ccBy);
    });

    it("should only find a shared license or one of the writer, never a draft or another writer's", async () => {
      vi.mocked(prisma.license.findFirst).mockResolvedValue(null);

      const result = uut.resolve({ licenseId: ccBy.id }, writerId);

      await expect(result).rejects.toThrow(NotFoundException);
      expect(prisma.license.findFirst).toHaveBeenCalledWith({
        where: {
          id: ccBy.id,
          isDraft: false,
          ownerId: { in: ['system', writerId] },
        },
      });
    });

    it('should reject a selection with both an id and a draft', async () => {
      const result = uut.resolve(
        { licenseId: ccBy.id, licenseDraft: noResale },
        writerId,
      );

      await expect(result).rejects.toThrow(BadRequestException);
    });
  });

  describe('setDefault', () => {
    it('should only take a shared license as the default, so every writer can use it', async () => {
      vi.mocked(prisma.license.findFirst).mockResolvedValue(
        ccBy as any,
      );

      await uut.setDefault({ licenseId: ccBy.id });

      expect(prisma.license.findFirst).toHaveBeenCalledWith({
        where: {
          id: ccBy.id,
          isDraft: false,
          ownerId: { in: ['system'] },
        },
      });
    });

    it('should store a text written for the default as a shared license', async () => {
      vi.mocked(prisma.license.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.license.findUniqueOrThrow).mockResolvedValue(
        ccBy as any,
      );
      vi.mocked(prisma.license.update).mockResolvedValue(ccBy as any);

      await uut.setDefault({ licenseDraft: noResale });

      expect(prisma.license.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ ownerId: 'system' })],
        skipDuplicates: true,
      });
    });

    it('should make the selected license the only default inside one locked transaction', async () => {
      vi.mocked(prisma.license.findFirst).mockResolvedValue(
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

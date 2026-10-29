import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { LicenseSourceType, Prisma } from '@prisma/client';
import { LICENSE_DRAFTS_PER_WRITER_MAX } from '@smart-novel/shared';

import type { CanonicalLicenseCatalog } from '../../fithara';
import type { PrismaService } from '../../prisma';
import type { LicenseService } from './license.service';

import { LicenseDraftService } from './license-draft.service';

describe(LicenseDraftService.name, () => {
  let uut: LicenseDraftService;
  let prisma: PrismaService;
  let licenseService: LicenseService;
  let catalog: CanonicalLicenseCatalog;

  const ownerId = '230104087265432001';
  const draftId = '5c1f4d0e-3b6a-4a57-9d3e-0b7a8f2c9e41';
  const draftRow = {
    id: draftId,
    name: 'CC BY 4.0 without resale',
    text: 'Attribution 4.0 International\n\nNo resale.',
    textHash: null,
    sourceType: LicenseSourceType.FORKED,
    canonicalId: 'CC-BY-4.0',
    isDefault: false,
    isDraft: true,
    ownerId,
    createdAt: new Date('2026-10-29T09:00:00.000Z'),
    updatedAt: new Date('2026-10-29T09:30:00.000Z'),
  };
  const realLicense = {
    id: '3f7b0c1e-6d52-4b8a-9a41-5c2e8d7f1a06',
    name: 'CC BY 4.0',
    text: 'Attribution 4.0 International',
    textHash:
      'b6b6e3dc0c0952737748e55d5d885272840c7e42ba41ab1d5489f693419882f5',
    sourceType: LicenseSourceType.CANONICAL,
    canonicalId: 'CC-BY-4.0',
    isDefault: true,
    isDraft: false,
    ownerId: null,
  };
  const draftOfTheOwner = {
    where: { id: draftId, ownerId, isDraft: true },
  };

  beforeEach(() => {
    prisma = {
      license: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue(draftRow),
        findFirst: vi.fn().mockResolvedValue(draftRow),
        findMany: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    } as any;
    licenseService = {
      findUsable: vi.fn(),
      prepareNew: vi.fn(),
    } as any;
    catalog = { findVerbatim: vi.fn() } as any;

    uut = new LicenseDraftService(prisma, licenseService, catalog);
  });

  describe('create', () => {
    it('should start an empty custom draft owned by the writer', async () => {
      const result = await uut.create(ownerId, {});

      expect(prisma.license.create).toHaveBeenCalledWith({
        data: {
          name: '',
          text: '',
          sourceType: LicenseSourceType.CUSTOM,
          canonicalId: null,
          ownerId,
          isDraft: true,
        },
      });
      expect(result).toEqual({
        id: draftId,
        ownerId,
        title: draftRow.name,
        text: draftRow.text,
        source: {
          type: LicenseSourceType.FORKED,
          canonicalId: 'CC-BY-4.0',
        },
        updatedAt: '2026-10-29T09:30:00.000Z',
      });
    });

    it('should start from the text of a license the writer may use, and no other', async () => {
      vi.mocked(licenseService.findUsable).mockResolvedValue(
        realLicense as any,
      );

      await uut.create(ownerId, { licenseId: realLicense.id });

      expect(licenseService.findUsable).toHaveBeenCalledWith(
        realLicense.id,
        ownerId,
      );
      expect(prisma.license.create).toHaveBeenCalledWith({
        data: {
          name: 'CC BY 4.0',
          text: 'Attribution 4.0 International',
          sourceType: LicenseSourceType.CANONICAL,
          canonicalId: 'CC-BY-4.0',
          ownerId,
          isDraft: true,
        },
      });
    });

    it('should start from the text of a canonical license of the registry', async () => {
      vi.mocked(catalog.findVerbatim).mockResolvedValue({
        id: 'CC-BY-NC-4.0',
        shortName: 'CC BY-NC 4.0',
        body: 'Attribution-NonCommercial 4.0 International',
      });

      await uut.create(ownerId, { canonicalId: 'CC-BY-NC-4.0' });

      expect(prisma.license.create).toHaveBeenCalledWith({
        data: {
          name: 'CC BY-NC 4.0',
          text: 'Attribution-NonCommercial 4.0 International',
          sourceType: LicenseSourceType.CANONICAL,
          canonicalId: 'CC-BY-NC-4.0',
          ownerId,
          isDraft: true,
        },
      });
    });

    it.each([
      [
        'both a license and a canonical license are given',
        { licenseId: realLicense.id, canonicalId: 'CC-BY-4.0' },
      ],
      ['the canonical license is unknown', { canonicalId: 'MIT-0' }],
    ])('should refuse when %s', async (_, input) => {
      vi.mocked(catalog.findVerbatim).mockResolvedValue(null);

      const result = uut.create(ownerId, input);

      await expect(result).rejects.toThrow(BadRequestException);
      expect(prisma.license.create).not.toHaveBeenCalled();
    });

    it("should not copy another writer's license", async () => {
      vi.mocked(licenseService.findUsable).mockRejectedValue(
        new NotFoundException('License with id x not found'),
      );

      const result = uut.create(ownerId, {
        licenseId: realLicense.id,
      });

      await expect(result).rejects.toThrow(NotFoundException);
      expect(prisma.license.create).not.toHaveBeenCalled();
    });

    it('should refuse a writer who already has the most drafts', async () => {
      vi.mocked(prisma.license.count).mockResolvedValue(
        LICENSE_DRAFTS_PER_WRITER_MAX,
      );

      const result = uut.create(ownerId, {});

      await expect(result).rejects.toThrow(
        'Finish or discard one first',
      );
      expect(prisma.license.count).toHaveBeenCalledWith({
        where: { ownerId, isDraft: true },
      });
      expect(prisma.license.create).not.toHaveBeenCalled();
    });
  });

  describe('save', () => {
    const input = {
      id: draftId,
      title: 'My license',
      text: 'You may read this novel.',
      source: { type: LicenseSourceType.CUSTOM },
    };

    it('should write the draft of the owner only, and only while it is a draft', async () => {
      vi.mocked(prisma.license.findFirst)
        .mockResolvedValueOnce(draftRow as any)
        .mockResolvedValueOnce({
          ...draftRow,
          name: input.title,
          text: input.text,
          sourceType: LicenseSourceType.CUSTOM,
          canonicalId: null,
        } as any);

      const result = await uut.save(ownerId, input);

      expect(prisma.license.updateMany).toHaveBeenCalledWith({
        ...draftOfTheOwner,
        data: {
          name: 'My license',
          text: 'You may read this novel.',
          sourceType: LicenseSourceType.CUSTOM,
          canonicalId: null,
        },
      });
      expect(result.title).toBe('My license');
    });

    it('should write nothing when the draft is saved as it is', async () => {
      const result = await uut.save(ownerId, {
        id: draftId,
        title: draftRow.name,
        text: draftRow.text,
        source: {
          type: LicenseSourceType.FORKED,
          canonicalId: 'CC-BY-4.0',
        },
      });

      expect(prisma.license.updateMany).not.toHaveBeenCalled();
      expect(result.updatedAt).toBe('2026-10-29T09:30:00.000Z');
    });

    it('should not find the draft of another writer', async () => {
      vi.mocked(prisma.license.findFirst).mockResolvedValue(null);

      const result = uut.save('someone else', input);

      await expect(result).rejects.toThrow(NotFoundException);
      expect(prisma.license.findFirst).toHaveBeenCalledWith({
        where: {
          id: draftId,
          ownerId: 'someone else',
          isDraft: true,
        },
      });
      expect(prisma.license.updateMany).not.toHaveBeenCalled();
    });

    it('should not change a draft that was finalized a moment ago', async () => {
      vi.mocked(prisma.license.updateMany).mockResolvedValue({
        count: 0,
      });

      const result = uut.save(ownerId, input);

      await expect(result).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    const writer = { id: ownerId, isAdmin: false };
    const admin = { id: 'admin-1', isAdmin: true };

    it("should read a writer's own draft only", async () => {
      await uut.findOne(writer, draftId);

      expect(prisma.license.findFirst).toHaveBeenCalledWith({
        where: { id: draftId, isDraft: true, ownerId },
      });
    });

    it("should let an admin read any writer's draft", async () => {
      const result = await uut.findOne(admin, draftId);

      expect(prisma.license.findFirst).toHaveBeenCalledWith({
        where: { id: draftId, isDraft: true },
      });
      expect(result.ownerId).toBe(ownerId);
    });

    it("should not find another writer's draft", async () => {
      vi.mocked(prisma.license.findFirst).mockResolvedValue(null);

      const result = uut.findOne(
        { id: 'someone else', isAdmin: false },
        draftId,
      );

      await expect(result).rejects.toThrow(NotFoundException);
    });
  });

  describe('findConnection', () => {
    const writer = { id: ownerId, isAdmin: false };
    const admin = { id: 'admin-1', isAdmin: true };
    const otherWriter = '260311094522198751';

    function row(id: string) {
      return { ...draftRow, id } as any;
    }

    it('should list the drafts of a writer, newest save first, when they name nobody', async () => {
      vi.mocked(prisma.license.findMany).mockResolvedValue([
        draftRow as any,
      ]);

      const result = await uut.findConnection(writer, { first: 10 });

      expect(prisma.license.findMany).toHaveBeenCalledWith({
        where: { isDraft: true, ownerId: { in: [ownerId] } },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        cursor: undefined,
        skip: undefined,
        take: 11,
      });
      expect(result.edges.map(({ node }) => node.id)).toEqual([
        draftId,
      ]);
    });

    it('should let a writer name themselves', async () => {
      vi.mocked(prisma.license.findMany).mockResolvedValue([]);

      await uut.findConnection(
        writer,
        { first: 10 },
        { ownerIds: [ownerId] },
      );

      expect(prisma.license.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isDraft: true, ownerId: { in: [ownerId] } },
        }),
      );
    });

    it.each([
      ['another writer', [otherWriter]],
      ['themselves and another writer', [ownerId, otherWriter]],
    ])(
      'should refuse a writer who names %s, before reading anything',
      async (_, ownerIds) => {
        const result = uut.findConnection(
          writer,
          { first: 10 },
          { ownerIds },
        );

        await expect(result).rejects.toThrow(ForbiddenException);
        expect(prisma.license.findMany).not.toHaveBeenCalled();
      },
    );

    it("should list everybody's drafts for an admin who names nobody, or an empty list", async () => {
      vi.mocked(prisma.license.findMany).mockResolvedValue([]);

      await uut.findConnection(admin, { first: 10 });
      await uut.findConnection(
        admin,
        { first: 10 },
        { ownerIds: [] },
      );

      for (const [args] of vi.mocked(prisma.license.findMany).mock
        .calls) {
        expect(args?.where).toEqual({ isDraft: true });
      }
    });

    it('should let an admin name several writers', async () => {
      vi.mocked(prisma.license.findMany).mockResolvedValue([]);

      await uut.findConnection(
        admin,
        { first: 10 },
        { ownerIds: [ownerId, otherWriter] },
      );

      expect(prisma.license.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isDraft: true,
            ownerId: { in: [ownerId, otherWriter] },
          },
        }),
      );
    });

    it('should continue after a cursor and say whether there is another page', async () => {
      const ids = [
        'a1111111-0000-4000-8000-000000000001',
        'a1111111-0000-4000-8000-000000000002',
        'a1111111-0000-4000-8000-000000000003',
      ];
      vi.mocked(prisma.license.findMany).mockResolvedValue(
        ids.map(row),
      );

      const result = await uut.findConnection(writer, {
        first: 2,
        after: Buffer.from('cursor-row').toString('base64'),
      });

      expect(prisma.license.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'cursor-row' },
          skip: 1,
          take: 3,
        }),
      );
      expect(result.edges.map(({ node }) => node.id)).toEqual(
        ids.slice(0, 2),
      );
      expect(result.edges[0].cursor).toBe(
        Buffer.from(ids[0]).toString('base64'),
      );
      expect(result.pageInfo).toEqual({
        startCursor: Buffer.from(ids[0]).toString('base64'),
        endCursor: Buffer.from(ids[1]).toString('base64'),
        hasPreviousPage: true,
        hasNextPage: true,
      });
    });

    it('should page backwards from a cursor and give the page in its normal order', async () => {
      const ids = [
        'a1111111-0000-4000-8000-000000000003',
        'a1111111-0000-4000-8000-000000000002',
      ];
      vi.mocked(prisma.license.findMany).mockResolvedValue(
        ids.map(row),
      );

      const result = await uut.findConnection(writer, {
        last: 2,
        before: Buffer.from('cursor-row').toString('base64'),
      });

      expect(prisma.license.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
          cursor: { id: 'cursor-row' },
        }),
      );
      expect(result.edges.map(({ node }) => node.id)).toEqual(
        [...ids].reverse(),
      );
    });
  });

  describe('discard', () => {
    it('should delete the draft of the owner', async () => {
      await uut.discard(ownerId, draftId);

      expect(prisma.license.deleteMany).toHaveBeenCalledWith(
        draftOfTheOwner,
      );
    });

    it('should not find what is not the draft of the caller', async () => {
      vi.mocked(prisma.license.deleteMany).mockResolvedValue({
        count: 0,
      });

      const result = uut.discard('someone else', draftId);

      await expect(result).rejects.toThrow(NotFoundException);
    });
  });

  describe('finalize', () => {
    const toCreate = {
      name: 'CC BY 4.0 without resale',
      text: 'Attribution 4.0 International\n\nNo resale.',
      textHash:
        'c0a5b9d1e4f7a2b8c3d6e9f0a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
      ownerId,
      sourceType: LicenseSourceType.FORKED,
      canonicalId: 'CC-BY-4.0',
    };

    it('should check the draft like any new license', async () => {
      vi.mocked(licenseService.prepareNew).mockResolvedValue({
        create: toCreate,
      });
      vi.mocked(prisma.license.findUniqueOrThrow).mockResolvedValue(
        realLicense as any,
      );

      await uut.finalize(ownerId, draftId);

      expect(licenseService.prepareNew).toHaveBeenCalledWith(
        {
          title: draftRow.name,
          text: draftRow.text,
          source: {
            type: LicenseSourceType.FORKED,
            canonicalId: 'CC-BY-4.0',
          },
        },
        ownerId,
      );
    });

    it('should make the draft a real license in place, keeping its owner', async () => {
      vi.mocked(licenseService.prepareNew).mockResolvedValue({
        create: toCreate,
      });
      vi.mocked(prisma.license.findUniqueOrThrow).mockResolvedValue({
        ...realLicense,
        id: draftId,
      } as any);

      const result = await uut.finalize(ownerId, draftId);

      expect(prisma.license.updateMany).toHaveBeenCalledWith({
        ...draftOfTheOwner,
        data: { ...toCreate, isDraft: false },
      });
      expect(result.id).toBe(draftId);
    });

    it('should return the stored license with the same text and delete the draft', async () => {
      vi.mocked(licenseService.prepareNew).mockResolvedValue({
        existing: realLicense as any,
      });

      const result = await uut.finalize(ownerId, draftId);

      expect(result).toBe(realLicense);
      expect(prisma.license.deleteMany).toHaveBeenCalledWith(
        draftOfTheOwner,
      );
      expect(prisma.license.updateMany).not.toHaveBeenCalled();
    });

    it('should fall back to the stored license when the same text was stored in the meantime', async () => {
      vi.mocked(licenseService.prepareNew).mockResolvedValue({
        create: toCreate,
      });
      vi.mocked(prisma.license.updateMany).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed',
          {
            code: 'P2002',
            clientVersion: '7.0.0',
          },
        ),
      );
      vi.mocked(prisma.license.findUniqueOrThrow).mockResolvedValue(
        realLicense as any,
      );

      const result = await uut.finalize(ownerId, draftId);

      expect(prisma.license.findUniqueOrThrow).toHaveBeenCalledWith({
        where: {
          ownerId_textHash: { ownerId, textHash: toCreate.textHash },
        },
      });
      expect(prisma.license.deleteMany).toHaveBeenCalledWith(
        draftOfTheOwner,
      );
      expect(result).toBe(realLicense);
    });

    it('should not hide any other database failure', async () => {
      vi.mocked(licenseService.prepareNew).mockResolvedValue({
        create: toCreate,
      });
      vi.mocked(prisma.license.updateMany).mockRejectedValue(
        new Error('connection lost'),
      );

      const result = uut.finalize(ownerId, draftId);

      await expect(result).rejects.toThrow('connection lost');
    });

    it('should keep a draft that is not valid yet', async () => {
      vi.mocked(licenseService.prepareNew).mockRejectedValue(
        new BadRequestException('A license needs a name and a text'),
      );

      const result = uut.finalize(ownerId, draftId);

      await expect(result).rejects.toThrow('needs a name and a text');
      expect(prisma.license.updateMany).not.toHaveBeenCalled();
      expect(prisma.license.deleteMany).not.toHaveBeenCalled();
    });

    it('should not finalize the draft of another writer', async () => {
      vi.mocked(prisma.license.findFirst).mockResolvedValue(null);

      const result = uut.finalize('someone else', draftId);

      await expect(result).rejects.toThrow(NotFoundException);
      expect(licenseService.prepareNew).not.toHaveBeenCalled();
    });

    it('should not finalize a draft that was discarded a moment ago', async () => {
      vi.mocked(licenseService.prepareNew).mockResolvedValue({
        create: toCreate,
      });
      vi.mocked(prisma.license.updateMany).mockResolvedValue({
        count: 0,
      });

      const result = uut.finalize(ownerId, draftId);

      await expect(result).rejects.toThrow(NotFoundException);
    });
  });
});

import { CustomLoggerService } from 'nestjs-backend-common';

import { PrismaService } from '../../prisma/prisma.service';
import { ChapterPolicy } from './chapter.policy';

describe(ChapterPolicy.name, () => {
  let uut: ChapterPolicy;
  let prisma: PrismaService;
  let logger: CustomLoggerService;

  beforeEach(() => {
    prisma = {
      novel: { findUnique: vi.fn() },
      chapter: { findUnique: vi.fn() },
    } as any;
    logger = { warn: vi.fn() } as any;

    uut = new ChapterPolicy(prisma, logger);
  });

  describe('read', () => {
    it('should allow any user role', async () => {
      const result = await uut.isAllowed({
        userId: 'user-1',
        userRoles: ['user'],
        resourceId: 'unknown',
        action: 'read',
      });

      expect(result).toBeTrue();
    });
  });

  describe('create', () => {
    it('should allow an admin without checking novel ownership', async () => {
      const result = await uut.isAllowed({
        userId: 'user-1',
        userRoles: ['admin'],
        resourceId: 'unknown',
        action: 'create',
        resourceAttributes: {
          novelId: '4754496a-ccb4-4a6b-805d-809a6cea97c8',
        },
      });

      expect(result).toBeTrue();
      expect(prisma.novel.findUnique).not.toHaveBeenCalled();
    });

    it('should allow a writer who owns the parent novel', async () => {
      vi.mocked(prisma.novel.findUnique).mockResolvedValue({
        ownerId: 'user-1',
      } as any);

      const result = await uut.isAllowed({
        userId: 'user-1',
        userRoles: ['writer'],
        resourceId: 'unknown',
        action: 'create',
        resourceAttributes: {
          novelId: '4754496a-ccb4-4a6b-805d-809a6cea97c8',
        },
      });

      expect(result).toBeTrue();
      expect(prisma.novel.findUnique).toHaveBeenCalledWith({
        where: { id: '4754496a-ccb4-4a6b-805d-809a6cea97c8' },
        select: { ownerId: true },
      });
    });

    it('should deny a writer who does not own the parent novel', async () => {
      vi.mocked(prisma.novel.findUnique).mockResolvedValue({
        ownerId: 'someone-else',
      } as any);

      const result = await uut.isAllowed({
        userId: 'user-1',
        userRoles: ['writer'],
        resourceId: 'unknown',
        action: 'create',
        resourceAttributes: {
          novelId: '4754496a-ccb4-4a6b-805d-809a6cea97c8',
        },
      });

      expect(result).toBeFalse();
    });

    it('should deny a plain user regardless of resourceAttributes', async () => {
      const result = await uut.isAllowed({
        userId: 'user-1',
        userRoles: ['user'],
        resourceId: 'unknown',
        action: 'create',
        resourceAttributes: {
          novelId: '4754496a-ccb4-4a6b-805d-809a6cea97c8',
        },
      });

      expect(result).toBeFalse();
      expect(prisma.novel.findUnique).not.toHaveBeenCalled();
    });

    it('should deny and log when resourceAttributes.novelId is missing', async () => {
      const result = await uut.isAllowed({
        userId: 'user-1',
        userRoles: ['writer'],
        resourceId: 'unknown',
        action: 'create',
        resourceAttributes: {},
      });

      expect(result).toBeFalse();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Missing novelId'),
      );
    });

    it('should deny and log when resourceAttributes itself is missing', async () => {
      const result = await uut.isAllowed({
        userId: 'user-1',
        userRoles: ['writer'],
        resourceId: 'unknown',
        action: 'create',
      });

      expect(result).toBeFalse();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Missing novelId'),
      );
    });
  });

  describe('update', () => {
    it('should allow an admin without checking ownership', async () => {
      const result = await uut.isAllowed({
        userId: 'user-1',
        userRoles: ['admin'],
        resourceId: '4bbc4da9-107c-4872-9809-78f6191a092d',
        action: 'update',
      });

      expect(result).toBeTrue();
      expect(prisma.chapter.findUnique).not.toHaveBeenCalled();
    });

    it('should allow a writer who owns the chapter’s parent novel', async () => {
      vi.mocked(prisma.chapter.findUnique).mockResolvedValue({
        novel: { ownerId: 'user-1' },
      } as any);

      const result = await uut.isAllowed({
        userId: 'user-1',
        userRoles: ['writer'],
        resourceId: '4bbc4da9-107c-4872-9809-78f6191a092d',
        action: 'update',
      });

      expect(result).toBeTrue();
      expect(prisma.chapter.findUnique).toHaveBeenCalledWith({
        where: { id: '4bbc4da9-107c-4872-9809-78f6191a092d' },
        select: { novel: { select: { ownerId: true } } },
      });
    });

    it('should deny a writer who does not own the chapter’s parent novel', async () => {
      vi.mocked(prisma.chapter.findUnique).mockResolvedValue({
        novel: { ownerId: 'someone-else' },
      } as any);

      const result = await uut.isAllowed({
        userId: 'user-1',
        userRoles: ['writer'],
        resourceId: '4bbc4da9-107c-4872-9809-78f6191a092d',
        action: 'update',
      });

      expect(result).toBeFalse();
    });

    it('should deny a plain user regardless of ownership', async () => {
      const result = await uut.isAllowed({
        userId: 'user-1',
        userRoles: ['user'],
        resourceId: '4bbc4da9-107c-4872-9809-78f6191a092d',
        action: 'update',
      });

      expect(result).toBeFalse();
      expect(prisma.chapter.findUnique).not.toHaveBeenCalled();
    });

    it('should deny and log when the chapter does not exist', async () => {
      vi.mocked(prisma.chapter.findUnique).mockResolvedValue(null);

      const result = await uut.isAllowed({
        userId: 'user-1',
        userRoles: ['writer'],
        resourceId: 'non-existent-chapter',
        action: 'update',
      });

      expect(result).toBeFalse();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('non-existent-chapter'),
      );
    });
  });

  describe('unknown action', () => {
    it('should deny and log', async () => {
      const result = await uut.isAllowed({
        userId: 'user-1',
        userRoles: ['admin'],
        resourceId: 'unknown',
        action: 'archive',
      });

      expect(result).toBeFalse();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Unknown chapter action: archive'),
      );
    });
  });
});

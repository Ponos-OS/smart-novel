import { ForbiddenException } from '@nestjs/common';
import { CustomLoggerService } from 'nestjs-backend-common';

import { PrismaService } from '../../prisma/prisma.service';
import { CaslAbilityFactory } from '../casl';
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

    uut = new ChapterPolicy(prisma, new CaslAbilityFactory(), logger);
  });

  describe('read', () => {
    it('should allow any user role', async () => {
      const result = await uut.isAllowed({
        userId: '234980127461293847',
        userRoles: ['user'],
        resourceId: 'unknown',
        action: 'read',
      });

      expect(result).toBeTrue();
    });
  });

  describe('create', () => {
    it('should allow a writer via the coarse role gate (ownership is checked separately via assertCanCreateInNovel)', async () => {
      const result = await uut.isAllowed({
        userId: '234980127461293847',
        userRoles: ['writer'],
        resourceId: 'unknown',
        action: 'create',
      });

      expect(result).toBeTrue();
    });

    it('should allow an admin', async () => {
      const result = await uut.isAllowed({
        userId: '234980127461293847',
        userRoles: ['admin'],
        resourceId: 'unknown',
        action: 'create',
      });

      expect(result).toBeTrue();
    });

    it('should deny a plain user', async () => {
      const result = await uut.isAllowed({
        userId: '234980127461293847',
        userRoles: ['user'],
        resourceId: 'unknown',
        action: 'create',
      });

      expect(result).toBeFalse();
    });
  });

  describe('assertCanCreateInNovel', () => {
    it('should resolve for an admin without checking novel ownership', async () => {
      const result = uut.assertCanCreateInNovel(
        { sub: '234980127461293847', roles: ['admin'] },
        '4754496a-ccb4-4a6b-805d-809a6cea97c8',
      );

      await expect(result).resolves.toBeUndefined();
      expect(prisma.novel.findUnique).not.toHaveBeenCalled();
    });

    it('should resolve for a writer who owns the novel', async () => {
      vi.mocked(prisma.novel.findUnique).mockResolvedValue({
        ownerId: '234980127461293847',
      } as any);

      const result = uut.assertCanCreateInNovel(
        { sub: '234980127461293847', roles: ['writer'] },
        '4754496a-ccb4-4a6b-805d-809a6cea97c8',
      );

      await expect(result).resolves.toBeUndefined();
      expect(prisma.novel.findUnique).toHaveBeenCalledWith({
        where: { id: '4754496a-ccb4-4a6b-805d-809a6cea97c8' },
        select: { ownerId: true },
      });
    });

    it('should throw ForbiddenException for a writer who does not own the novel — regression test: an unconditional CASL create rule would silently let this through', async () => {
      vi.mocked(prisma.novel.findUnique).mockResolvedValue({
        ownerId: '268103642598401',
      } as any);

      const result = uut.assertCanCreateInNovel(
        { sub: '234980127461293847', roles: ['writer'] },
        '4754496a-ccb4-4a6b-805d-809a6cea97c8',
      );

      await expect(result).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when the novel does not exist', async () => {
      vi.mocked(prisma.novel.findUnique).mockResolvedValue(null);

      const result = uut.assertCanCreateInNovel(
        { sub: '234980127461293847', roles: ['writer'] },
        'non-existent-novel',
      );

      await expect(result).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('should allow an admin without checking ownership', async () => {
      const result = await uut.isAllowed({
        userId: '234980127461293847',
        userRoles: ['admin'],
        resourceId: '4bbc4da9-107c-4872-9809-78f6191a092d',
        action: 'update',
      });

      expect(result).toBeTrue();
      expect(prisma.chapter.findUnique).not.toHaveBeenCalled();
    });

    it('should allow a writer who owns the chapter’s parent novel', async () => {
      vi.mocked(prisma.chapter.findUnique).mockResolvedValue({
        novel: { ownerId: '234980127461293847' },
      } as any);

      const result = await uut.isAllowed({
        userId: '234980127461293847',
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
        novel: { ownerId: '268103642598401' },
      } as any);

      const result = await uut.isAllowed({
        userId: '234980127461293847',
        userRoles: ['writer'],
        resourceId: '4bbc4da9-107c-4872-9809-78f6191a092d',
        action: 'update',
      });

      expect(result).toBeFalse();
    });

    it('should deny a plain user regardless of ownership', async () => {
      const result = await uut.isAllowed({
        userId: '234980127461293847',
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
        userId: '234980127461293847',
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
        userId: '234980127461293847',
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

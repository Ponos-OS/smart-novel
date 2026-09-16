import { CustomLoggerService } from 'nestjs-backend-common';

import { PrismaService } from '../../prisma/prisma.service';
import { NovelPolicy } from './novel.policy';

describe(NovelPolicy.name, () => {
  let uut: NovelPolicy;
  let prisma: PrismaService;
  let logger: CustomLoggerService;

  beforeEach(() => {
    prisma = {
      novel: { findUnique: vi.fn() },
    } as any;
    logger = { warn: vi.fn() } as any;

    uut = new NovelPolicy(prisma, logger);
  });

  describe('read', () => {
    it('should allow any user role', async () => {
      const result = await uut.isAllowed({
        userId: 'user-1',
        userRoles: ['user'],
        resourceId: '4754496a-ccb4-4a6b-805d-809a6cea97c8',
        action: 'read',
      });

      expect(result).toBeTrue();
    });
  });

  describe('create', () => {
    it('should allow a writer', async () => {
      const result = await uut.isAllowed({
        userId: 'user-1',
        userRoles: ['writer'],
        resourceId: 'unknown',
        action: 'create',
      });

      expect(result).toBeTrue();
    });

    it('should deny a user without at least the writer role', async () => {
      const result = await uut.isAllowed({
        userId: 'user-1',
        userRoles: ['user'],
        resourceId: 'unknown',
        action: 'create',
      });

      expect(result).toBeFalse();
    });
  });

  describe.each(['update', 'delete'] as const)('%s', (action) => {
    it('should allow an admin regardless of ownership', async () => {
      const result = await uut.isAllowed({
        userId: 'user-1',
        userRoles: ['admin'],
        resourceId: '4754496a-ccb4-4a6b-805d-809a6cea97c8',
        action,
      });

      expect(result).toBeTrue();
      expect(prisma.novel.findUnique).not.toHaveBeenCalled();
    });

    it('should allow a writer who owns the novel', async () => {
      vi.mocked(prisma.novel.findUnique).mockResolvedValue({
        ownerId: 'user-1',
      } as any);

      const result = await uut.isAllowed({
        userId: 'user-1',
        userRoles: ['writer'],
        resourceId: '4754496a-ccb4-4a6b-805d-809a6cea97c8',
        action,
      });

      expect(result).toBeTrue();
    });

    it('should deny a writer who does not own the novel', async () => {
      vi.mocked(prisma.novel.findUnique).mockResolvedValue({
        ownerId: 'someone-else',
      } as any);

      const result = await uut.isAllowed({
        userId: 'user-1',
        userRoles: ['writer'],
        resourceId: '4754496a-ccb4-4a6b-805d-809a6cea97c8',
        action,
      });

      expect(result).toBeFalse();
    });

    it('should deny a plain user regardless of ownership', async () => {
      const result = await uut.isAllowed({
        userId: 'user-1',
        userRoles: ['user'],
        resourceId: '4754496a-ccb4-4a6b-805d-809a6cea97c8',
        action,
      });

      expect(result).toBeFalse();
      expect(prisma.novel.findUnique).not.toHaveBeenCalled();
    });

    it('should deny and log when the novel does not exist', async () => {
      vi.mocked(prisma.novel.findUnique).mockResolvedValue(null);

      const result = await uut.isAllowed({
        userId: 'user-1',
        userRoles: ['writer'],
        resourceId: 'non-existent-novel',
        action,
      });

      expect(result).toBeFalse();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('non-existent-novel'),
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
        expect.stringContaining('Unknown novel action: archive'),
      );
    });
  });
});

import type { CustomLoggerService } from 'nestjs-backend-common';

import { PLATFORM_TERMS_VERSION_MISMATCH } from '@smart-novel/shared';

import type { PrismaService } from '../prisma';
import type { RedisService } from '../redis';

import { PlatformTermsService } from './platform-terms.service';

describe(PlatformTermsService.name, () => {
  let uut: PlatformTermsService;
  let prisma: PrismaService;
  let redis: RedisService;
  let logger: CustomLoggerService;

  const userId = '260311094522198751';
  const terms = { version: 2, markdown: '# Platform License' };
  const cacheKey = `platform-terms:accepted:${userId}:2`;

  beforeEach(() => {
    prisma = {
      platformTermsAcceptance: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        createMany: vi.fn(),
      },
    } as any;
    redis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(true),
    } as any;
    logger = { warn: vi.fn() } as any;

    uut = new PlatformTermsService(terms, prisma, redis, logger);
  });

  describe('getStatus', () => {
    it.each([
      {
        scenario: 'nothing accepted',
        versions: [],
        expected: {
          acceptedVersion: null,
          accepted: false,
          acceptedAt: null,
        },
      },
      {
        scenario: 'only an older version accepted',
        versions: [1],
        expected: {
          acceptedVersion: 1,
          accepted: false,
          acceptedAt: null,
        },
      },
      {
        scenario: 'the current version accepted after an older one',
        versions: [1, 2],
        expected: {
          acceptedVersion: 2,
          accepted: true,
          acceptedAt: '2026-10-29T09:30:00.000Z',
        },
      },
    ])('should report $scenario', async ({ versions, expected }) => {
      vi.mocked(
        prisma.platformTermsAcceptance.findMany,
      ).mockResolvedValue(
        versions.map((termsVersion) => ({
          termsVersion,
          acceptedAt: new Date('2026-10-29T09:30:00.000Z'),
        })) as any,
      );

      const result = await uut.getStatus(userId);

      expect(result).toEqual({ requiredVersion: 2, ...expected });
    });
  });

  describe('hasAcceptedCurrent', () => {
    it('should answer from Redis without touching the database', async () => {
      vi.mocked(redis.get).mockResolvedValue('1');

      const result = await uut.hasAcceptedCurrent(userId);

      expect(result).toBeTrue();
      expect(redis.get).toHaveBeenCalledWith(cacheKey);
      expect(
        prisma.platformTermsAcceptance.findUnique,
      ).not.toHaveBeenCalled();
    });

    it('should look the acceptance up and cache it on a cache miss', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(
        prisma.platformTermsAcceptance.findUnique,
      ).mockResolvedValue({
        id: 'c6e0d1a2-3b4f-4a5c-9d8e-7f6a5b4c3d2e',
      } as any);

      const result = await uut.hasAcceptedCurrent(userId);

      expect(result).toBeTrue();
      expect(
        prisma.platformTermsAcceptance.findUnique,
      ).toHaveBeenCalledWith({
        where: { userId_termsVersion: { userId, termsVersion: 2 } },
        select: { id: true },
      });
      expect(redis.set).toHaveBeenCalledWith(
        cacheKey,
        '1',
        expect.toBePositive(),
      );
    });

    it('should not cache a missing acceptance', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(
        prisma.platformTermsAcceptance.findUnique,
      ).mockResolvedValue(null);

      const result = await uut.hasAcceptedCurrent(userId);

      expect(result).toBeFalse();
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('should fall back to the database when Redis is down', async () => {
      vi.mocked(redis.get).mockRejectedValue(
        new Error('ECONNREFUSED'),
      );
      vi.mocked(redis.set).mockRejectedValue(
        new Error('ECONNREFUSED'),
      );
      vi.mocked(
        prisma.platformTermsAcceptance.findUnique,
      ).mockResolvedValue({
        id: 'c6e0d1a2-3b4f-4a5c-9d8e-7f6a5b4c3d2e',
      } as any);

      const result = await uut.hasAcceptedCurrent(userId);

      expect(result).toBeTrue();
      expect(logger.warn).toHaveBeenCalledTimes(2);
    });
  });

  describe('accept', () => {
    it('should record the acceptance idempotently and cache it', async () => {
      vi.mocked(
        prisma.platformTermsAcceptance.findMany,
      ).mockResolvedValue([
        {
          termsVersion: 2,
          acceptedAt: new Date('2026-10-29T09:30:00.000Z'),
        },
      ] as any);

      const result = await uut.accept(userId, 2);

      expect(
        prisma.platformTermsAcceptance.createMany,
      ).toHaveBeenCalledWith({
        data: [{ userId, termsVersion: 2 }],
        skipDuplicates: true,
      });
      expect(redis.set).toHaveBeenCalledWith(
        cacheKey,
        '1',
        expect.toBePositive(),
      );
      expect(result).toEqual({
        requiredVersion: 2,
        acceptedVersion: 2,
        accepted: true,
        acceptedAt: '2026-10-29T09:30:00.000Z',
      });
    });

    it.each([1, 3])(
      'should reject the stale or unknown version %s without recording anything',
      async (version) => {
        const result = uut.accept(userId, version);

        await expect(result).rejects.toMatchObject({
          extensions: { code: PLATFORM_TERMS_VERSION_MISMATCH },
        });
        expect(
          prisma.platformTermsAcceptance.createMany,
        ).not.toHaveBeenCalled();
        expect(redis.set).not.toHaveBeenCalled();
      },
    );
  });
});

import { PrismaService } from '../../prisma/prisma.service';
import { PrismaChapterUserStateRepository } from './prisma-chapter-user-state.repository';

describe(PrismaChapterUserStateRepository.name, () => {
  let uut: PrismaChapterUserStateRepository;
  let prismaService: PrismaService;

  beforeEach(async () => {
    prismaService = {
      chapterUserState: {
        createMany: vi.fn(),
        findMany: vi.fn(),
        deleteMany: vi.fn(),
      },
    } as any;

    uut = new PrismaChapterUserStateRepository(prismaService);
  });

  describe('markChaptersRead', () => {
    it('should mark multiple chapters as read and return count', async () => {
      const userId = 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d';
      const chapterData = [
        {
          chapterId: 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
          novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
        },
        {
          chapterId: '904bf826-33be-4172-b63f-665bba9007b9',
          novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
        },
      ];
      vi.mocked(
        prismaService.chapterUserState.createMany,
      ).mockResolvedValue({
        count: 2,
      });

      const result = await uut.markChaptersRead(userId, chapterData);

      expect(result).toBe(2);
      expect(
        prismaService.chapterUserState.createMany,
      ).toHaveBeenCalledWith({
        data: [
          {
            userId: 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d',
            chapterId: 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
            novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
          },
          {
            userId: 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d',
            chapterId: '904bf826-33be-4172-b63f-665bba9007b9',
            novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
          },
        ],
        skipDuplicates: true,
      });
    });

    it('should mark single chapter as read', async () => {
      const userId = 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d';
      const chapterData = [
        {
          chapterId: 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
          novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
        },
      ];
      vi.mocked(
        prismaService.chapterUserState.createMany,
      ).mockResolvedValue({
        count: 1,
      });

      const result = await uut.markChaptersRead(userId, chapterData);

      expect(result).toBe(1);
      expect(
        prismaService.chapterUserState.createMany,
      ).toHaveBeenCalledWith({
        data: [
          {
            userId: 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d',
            chapterId: 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
            novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
          },
        ],
        skipDuplicates: true,
      });
    });

    it('should skip duplicates when marking chapters as read', async () => {
      const userId = 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d';
      const chapterData = [
        {
          chapterId: 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
          novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
        },
        {
          chapterId: 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
          novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
        },
      ];
      vi.mocked(
        prismaService.chapterUserState.createMany,
      ).mockResolvedValue({
        count: 1,
      });

      const result = await uut.markChaptersRead(userId, chapterData);

      expect(result).toBe(1);
      expect(
        prismaService.chapterUserState.createMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          skipDuplicates: true,
        }),
      );
    });

    it('should return 0 when no chapters are marked', async () => {
      const userId = 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d';
      const chapterData = [
        {
          chapterId: 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
          novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
        },
      ];
      vi.mocked(
        prismaService.chapterUserState.createMany,
      ).mockResolvedValue({
        count: 0,
      });

      const result = await uut.markChaptersRead(userId, chapterData);

      expect(result).toBe(0);
    });

    it('should handle empty chapter data array', async () => {
      const userId = 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d';
      const chapterData: Array<{
        chapterId: string;
        novelId: string;
      }> = [];
      vi.mocked(
        prismaService.chapterUserState.createMany,
      ).mockResolvedValue({
        count: 0,
      });

      const result = await uut.markChaptersRead(userId, chapterData);

      expect(result).toBe(0);
      expect(
        prismaService.chapterUserState.createMany,
      ).toHaveBeenCalledWith({
        data: [],
        skipDuplicates: true,
      });
    });

    it('should throw when database fails', async () => {
      const error = new Error('Database connection error');
      const userId = 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d';
      const chapterData = [
        {
          chapterId: 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
          novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
        },
      ];
      vi.mocked(
        prismaService.chapterUserState.createMany,
      ).mockRejectedValue(error);

      const result = uut.markChaptersRead(userId, chapterData);

      await expect(result).rejects.toThrowError(error);
    });
  });

  describe('findReadChapterIds', () => {
    it('should return array of read chapter IDs for user and novel', async () => {
      const userId = 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d';
      const novelId = '248c9fee-cad0-43fc-9abb-c2ab8ff002ec';
      const mockRecords = [
        { chapterId: 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c' },
        { chapterId: '904bf826-33be-4172-b63f-665bba9007b9' },
        { chapterId: '041be636-8bd3-44b4-a22c-29703b2b63e5' },
      ];
      vi.mocked(
        prismaService.chapterUserState.findMany,
      ).mockResolvedValue(mockRecords as any);

      const result = await uut.findReadChapterIds(userId, novelId);

      expect(result).toEqual([
        'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
        '904bf826-33be-4172-b63f-665bba9007b9',
        '041be636-8bd3-44b4-a22c-29703b2b63e5',
      ]);
      expect(
        prismaService.chapterUserState.findMany,
      ).toHaveBeenCalledWith({
        where: {
          userId: 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d',
          novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
        },
        select: {
          chapterId: true,
        },
      });
    });

    it('should return empty array when user has not read any chapters', async () => {
      const userId = 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d';
      const novelId = '248c9fee-cad0-43fc-9abb-c2ab8ff002ec';
      vi.mocked(
        prismaService.chapterUserState.findMany,
      ).mockResolvedValue([]);

      const result = await uut.findReadChapterIds(userId, novelId);

      expect(result).toEqual([]);
    });

    it('should return single chapter ID when only one chapter is read', async () => {
      const userId = 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d';
      const novelId = '248c9fee-cad0-43fc-9abb-c2ab8ff002ec';
      const mockRecords = [
        { chapterId: 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c' },
      ];
      vi.mocked(
        prismaService.chapterUserState.findMany,
      ).mockResolvedValue(mockRecords as any);

      const result = await uut.findReadChapterIds(userId, novelId);

      expect(result).toEqual([
        'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
      ]);
    });

    it('should throw when database fails', async () => {
      const error = new Error('Database query failed');
      const userId = 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d';
      const novelId = '248c9fee-cad0-43fc-9abb-c2ab8ff002ec';
      vi.mocked(
        prismaService.chapterUserState.findMany,
      ).mockRejectedValue(error);

      const result = uut.findReadChapterIds(userId, novelId);

      await expect(result).rejects.toThrowError(error);
    });
  });

  describe('batchLoadByChapterIds', () => {
    it('should return map of chapter user states by chapter ID', async () => {
      const userId = 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d';
      const chapterIds = [
        'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
        '904bf826-33be-4172-b63f-665bba9007b9',
      ];
      const mockRecords = [
        {
          userId: 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d',
          novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
          chapterId: 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
          firstReadAt: new Date('2024-01-15T10:30:00Z'),
        },
        {
          userId: 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d',
          novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
          chapterId: '904bf826-33be-4172-b63f-665bba9007b9',
          firstReadAt: new Date('2024-01-16T14:20:00Z'),
        },
      ];
      vi.mocked(
        prismaService.chapterUserState.findMany,
      ).mockResolvedValue(mockRecords as any);

      const result = await uut.batchLoadByChapterIds(
        userId,
        chapterIds,
      );

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);
      expect(
        result.get('bb563ad5-1ac4-46c2-a25f-6f62d245f44c'),
      ).toEqual({
        userId: 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d',
        novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
        chapterId: 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
        firstReadAt: '2024-01-15T10:30:00.000Z',
      });
      expect(
        result.get('904bf826-33be-4172-b63f-665bba9007b9'),
      ).toEqual({
        userId: 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d',
        novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
        chapterId: '904bf826-33be-4172-b63f-665bba9007b9',
        firstReadAt: '2024-01-16T14:20:00.000Z',
      });
      expect(
        prismaService.chapterUserState.findMany,
      ).toHaveBeenCalledWith({
        where: {
          userId: 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d',
          chapterId: {
            in: [
              'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
              '904bf826-33be-4172-b63f-665bba9007b9',
            ],
          },
        },
      });
    });

    it('should return empty map when no chapters found', async () => {
      const userId = 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d';
      const chapterIds = ['bb563ad5-1ac4-46c2-a25f-6f62d245f44c'];
      vi.mocked(
        prismaService.chapterUserState.findMany,
      ).mockResolvedValue([]);

      const result = await uut.batchLoadByChapterIds(
        userId,
        chapterIds,
      );

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should handle single chapter ID', async () => {
      const userId = 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d';
      const chapterIds = ['bb563ad5-1ac4-46c2-a25f-6f62d245f44c'];
      const mockRecords = [
        {
          userId: 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d',
          novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
          chapterId: 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
          firstReadAt: new Date('2024-01-15T10:30:00Z'),
        },
      ];
      vi.mocked(
        prismaService.chapterUserState.findMany,
      ).mockResolvedValue(mockRecords as any);

      const result = await uut.batchLoadByChapterIds(
        userId,
        chapterIds,
      );

      expect(result.size).toBe(1);
      expect(
        result.get('bb563ad5-1ac4-46c2-a25f-6f62d245f44c'),
      ).toEqual({
        userId: 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d',
        novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
        chapterId: 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
        firstReadAt: '2024-01-15T10:30:00.000Z',
      });
    });

    it('should handle empty chapter IDs array', async () => {
      const userId = 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d';
      const chapterIds: string[] = [];
      vi.mocked(
        prismaService.chapterUserState.findMany,
      ).mockResolvedValue([]);

      const result = await uut.batchLoadByChapterIds(
        userId,
        chapterIds,
      );

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      expect(
        prismaService.chapterUserState.findMany,
      ).toHaveBeenCalledWith({
        where: {
          userId: 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d',
          chapterId: {
            in: [],
          },
        },
      });
    });

    it('should convert firstReadAt Date to ISO string', async () => {
      const userId = 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d';
      const chapterIds = ['bb563ad5-1ac4-46c2-a25f-6f62d245f44c'];
      const firstReadAtDate = new Date('2024-03-20T08:45:30.123Z');
      const mockRecords = [
        {
          userId: 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d',
          novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
          chapterId: 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
          firstReadAt: firstReadAtDate,
        },
      ];
      vi.mocked(
        prismaService.chapterUserState.findMany,
      ).mockResolvedValue(mockRecords as any);

      const result = await uut.batchLoadByChapterIds(
        userId,
        chapterIds,
      );

      const state = result.get(
        'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
      );
      expect(state?.firstReadAt).toBe('2024-03-20T08:45:30.123Z');
      expect(typeof state?.firstReadAt).toBe('string');
    });

    it('should handle multiple chapters from different novels', async () => {
      const userId = 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d';
      const chapterIds = [
        'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
        '904bf826-33be-4172-b63f-665bba9007b9',
      ];
      const mockRecords = [
        {
          userId: 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d',
          novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
          chapterId: 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
          firstReadAt: new Date('2024-01-15T10:30:00Z'),
        },
        {
          userId: 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d',
          novelId: '86537331-b426-4081-aa4e-e58daf533a97',
          chapterId: '904bf826-33be-4172-b63f-665bba9007b9',
          firstReadAt: new Date('2024-01-16T14:20:00Z'),
        },
      ];
      vi.mocked(
        prismaService.chapterUserState.findMany,
      ).mockResolvedValue(mockRecords as any);

      const result = await uut.batchLoadByChapterIds(
        userId,
        chapterIds,
      );

      expect(result.size).toBe(2);
      expect(
        result.get('bb563ad5-1ac4-46c2-a25f-6f62d245f44c')?.novelId,
      ).toBe('248c9fee-cad0-43fc-9abb-c2ab8ff002ec');
      expect(
        result.get('904bf826-33be-4172-b63f-665bba9007b9')?.novelId,
      ).toBe('86537331-b426-4081-aa4e-e58daf533a97');
    });

    it('should throw when database fails', async () => {
      const error = new Error('Database timeout');
      const userId = 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d';
      const chapterIds = ['bb563ad5-1ac4-46c2-a25f-6f62d245f44c'];
      vi.mocked(
        prismaService.chapterUserState.findMany,
      ).mockRejectedValue(error);

      const result = uut.batchLoadByChapterIds(userId, chapterIds);

      await expect(result).rejects.toThrowError(error);
    });
  });

  describe('deleteAllForUser', () => {
    it('should delete all chapter user states for a user', async () => {
      const userId = 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d';
      vi.mocked(
        prismaService.chapterUserState.deleteMany,
      ).mockResolvedValue({
        count: 5,
      });

      const result = await uut.deleteAllForUser(userId);

      expect(result).toBe(5);
      expect(
        prismaService.chapterUserState.deleteMany,
      ).toHaveBeenCalledWith({
        where: {
          userId: 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d',
        },
      });
    });

    it('should throw when database fails', async () => {
      const error = new Error('Database deletion failed');
      const userId = 'a7f3e8d2-4b9c-4f1a-8e6d-2c5b3a9f1e4d';
      vi.mocked(
        prismaService.chapterUserState.deleteMany,
      ).mockRejectedValue(error);

      const result = uut.deleteAllForUser(userId);

      await expect(result).rejects.toThrow(error);
    });
  });
});

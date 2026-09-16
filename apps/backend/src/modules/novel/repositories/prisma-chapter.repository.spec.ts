import { NarrationStatus } from '@prisma/client';

import { OrderDirection } from '../../../shared';
import { PrismaService } from '../../prisma';
import { ChapterOrderField } from '../enums';
import { PrismaChapterRepository } from './prisma-chapter.repository';

describe(PrismaChapterRepository.name, () => {
  let uut: PrismaChapterRepository;
  let prismaService: PrismaService;

  beforeEach(async () => {
    prismaService = {
      novel: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      chapter: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      category: {
        findMany: vi.fn(),
      },
      $transaction: vi.fn(),
    } as any;

    uut = new PrismaChapterRepository(prismaService);
  });

  describe('createChapter', () => {
    it('should assign the next chapter number and create the chapter with its content in a transaction', async () => {
      const createdChapter = {
        id: 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
        novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
        contentId: 'ccc63ad5-1ac4-46c2-a25f-6f62d245f44c',
        title: 'Chapter 2: The Journey',
        chapterNumber: 2,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
        narrationStatus: null,
        narrationUrl: null,
      };
      const tx = {
        chapter: {
          findFirst: vi.fn().mockResolvedValue({ chapterNumber: 1 }),
          create: vi.fn().mockResolvedValue(createdChapter),
        },
      };
      vi.mocked(prismaService.$transaction).mockImplementation(
        (cb: any) => cb(tx),
      );

      const result = await uut.createChapter({
        novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
        title: 'Chapter 2: The Journey',
        content: '# Chapter 2\n\nThe journey continues.',
      });

      expect(tx.chapter.findFirst).toHaveBeenCalledWith({
        where: { novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec' },
        orderBy: { chapterNumber: 'desc' },
        select: { chapterNumber: true },
      });
      expect(tx.chapter.create).toHaveBeenCalledWith({
        data: {
          novel: {
            connect: { id: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec' },
          },
          title: 'Chapter 2: The Journey',
          chapterNumber: 2,
          content: {
            create: {
              content: '# Chapter 2\n\nThe journey continues.',
              contentHash: expect.any(String),
            },
          },
        },
      });
      expect(result.chapterNumber).toBe(2);
      expect(result.id).toBe(createdChapter.id);
    });

    it('should assign chapter number 1 when the novel has no chapters yet', async () => {
      const createdChapter = {
        id: 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
        novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
        contentId: 'ccc63ad5-1ac4-46c2-a25f-6f62d245f44c',
        title: 'Chapter 1: The Beginning',
        chapterNumber: 1,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
        narrationStatus: null,
        narrationUrl: null,
      };
      const tx = {
        chapter: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue(createdChapter),
        },
      };
      vi.mocked(prismaService.$transaction).mockImplementation(
        (cb: any) => cb(tx),
      );

      const result = await uut.createChapter({
        novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
        title: 'Chapter 1: The Beginning',
        content: '# Chapter 1\n\nIt was a dark and stormy night.',
      });

      expect(tx.chapter.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ chapterNumber: 1 }),
        }),
      );
      expect(result.chapterNumber).toBe(1);
    });

    it('should throw when the transaction fails', async () => {
      const error = new Error('Database error');
      vi.mocked(prismaService.$transaction).mockRejectedValue(error);

      const result = uut.createChapter({
        novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
        title: 'Chapter 1: The Beginning',
        content: '# Chapter 1\n\nIt was a dark and stormy night.',
      });

      await expect(result).rejects.toThrowError(error);
    });
  });

  describe('findManyByNovelAndChapterNumbers', () => {
    it('should return empty array when keys is empty array', async () => {
      const result = await uut.findManyByNovelAndChapterNumbers([]);

      expect(result).toStrictEqual([]);
      expect(prismaService.chapter.findMany).not.toHaveBeenCalled();
    });

    it('should return chapters matching a single novel and chapter number', async () => {
      const { novel1Chapter1 } = getMockedData();
      vi.mocked(prismaService.chapter.findMany).mockResolvedValue([
        novel1Chapter1,
      ] as any);

      const result = await uut.findManyByNovelAndChapterNumbers([
        { novelId: novel1Chapter1.novelId, chapterNumber: 1 },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0]).toStrictEqual(
        expect.objectContaining({
          id: novel1Chapter1.id,
          novelId: novel1Chapter1.novelId,
          createdAt: novel1Chapter1.createdAt.toISOString(),
          updatedAt: novel1Chapter1.updatedAt.toISOString(),
        }),
      );
      expect(prismaService.chapter.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            {
              novelId: novel1Chapter1.novelId,
              chapterNumber: { in: [1] },
            },
          ],
        },
      });
    });

    it('should group multiple chapter numbers under the same novel', async () => {
      const { novel1, novel2 } = getMockedData();
      vi.mocked(prismaService.chapter.findMany).mockResolvedValue([]);

      await uut.findManyByNovelAndChapterNumbers([
        { novelId: novel1.id, chapterNumber: 1 },
        { novelId: novel1.id, chapterNumber: 2 },
        { novelId: novel2.id, chapterNumber: 1 },
      ]);
      console.dir(
        vi.mocked(prismaService.chapter.findMany).mock.calls,
        { depth: null },
      );

      expect(prismaService.chapter.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            {
              novelId: novel1.id,
              chapterNumber: { in: [1, 2] },
            },
            {
              novelId: novel2.id,
              chapterNumber: { in: [1] },
            },
          ],
        },
      });
    });

    it('should throw when database fails', async () => {
      const error = new Error('Database error');
      vi.mocked(prismaService.chapter.findMany).mockRejectedValue(
        error,
      );

      const result = uut.findManyByNovelAndChapterNumbers([
        {
          novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
          chapterNumber: 1,
        },
      ]);

      await expect(result).rejects.toThrowError(error);
    });
  });

  describe('findById', () => {
    it('should return chapter by id with contentId but without content', async () => {
      const { novel1Chapter1 } = getMockedData();
      vi.mocked(prismaService.chapter.findFirst).mockResolvedValue(
        novel1Chapter1 as any,
      );

      const result = await uut.findById(novel1Chapter1.id);

      expect(result).toStrictEqual({
        id: novel1Chapter1.id,
        novelId: novel1Chapter1.novelId,
        contentId: novel1Chapter1.contentId,
        title: novel1Chapter1.title,
        chapterNumber: novel1Chapter1.chapterNumber,
        createdAt: novel1Chapter1.createdAt.toISOString(),
        updatedAt: novel1Chapter1.updatedAt.toISOString(),
        narrationStatus: novel1Chapter1.narrationStatus,
        narrationUrl: novel1Chapter1.narrationUrl,
      });
      expect(prismaService.chapter.findFirst).toHaveBeenCalledWith({
        where: { id: novel1Chapter1.id },
      });
    });

    it('should return null when chapter is not found', async () => {
      vi.mocked(prismaService.chapter.findFirst).mockResolvedValue(
        null,
      );

      const result = await uut.findById('non-existent-uuid');

      expect(result).toBeNull();
    });

    it('should throw when database fails', async () => {
      const error = new Error('Database error');
      vi.mocked(prismaService.chapter.findFirst).mockRejectedValue(
        error,
      );

      const result = uut.findById(
        '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
      );

      await expect(result).rejects.toThrowError(error);
    });
  });

  describe('getChapter', () => {
    it('should return chapter by novelId and chapterId', async () => {
      const { novel1Chapter2 } = getMockedData();
      vi.mocked(prismaService.chapter.findFirst).mockResolvedValue(
        novel1Chapter2 as any,
      );

      const result = await uut.getChapter(
        novel1Chapter2.novelId,
        novel1Chapter2.id,
      );
      console.dir(result, { depth: null });

      expect(result).toStrictEqual({
        id: novel1Chapter2.id,
        novelId: novel1Chapter2.novelId,
        contentId: novel1Chapter2.contentId,
        title: novel1Chapter2.title,
        chapterNumber: novel1Chapter2.chapterNumber,
        createdAt: novel1Chapter2.createdAt.toISOString(),
        updatedAt: novel1Chapter2.updatedAt.toISOString(),
        narrationStatus: novel1Chapter2.narrationStatus,
        narrationUrl: undefined,
      });
      expect(prismaService.chapter.findFirst).toHaveBeenCalledWith({
        where: {
          id: novel1Chapter2.id,
          novelId: novel1Chapter2.novelId,
        },
      });
    });

    it('should return null when chapter is not found', async () => {
      vi.mocked(prismaService.chapter.findFirst).mockResolvedValue(
        null,
      );
      const novelId = '248c9fee-cad0-43fc-9abb-c2ab8ff002ec';
      const chapterId = 'non-existent-uuid';

      const result = await uut.getChapter(novelId, chapterId);

      expect(result).toBeNull();
    });

    it('should handle chapter with null narrationUrl and narrationStatus', async () => {
      const { novel1Chapter3 } = getMockedData();
      const chapterWithoutNarration = {
        ...novel1Chapter3,
        narrationStatus: null,
        narrationUrl: null,
      };
      vi.mocked(prismaService.chapter.findFirst).mockResolvedValue(
        chapterWithoutNarration as any,
      );
      const novelId = '248c9fee-cad0-43fc-9abb-c2ab8ff002ec';

      const result = await uut.getChapter(novelId, novel1Chapter3.id);

      expect(result?.narrationStatus).toBeNull();
      expect(result?.narrationUrl).toBeUndefined();
    });

    it('should throw when database fails', async () => {
      const error = new Error('Database error');
      vi.mocked(prismaService.chapter.findFirst).mockRejectedValue(
        error,
      );

      const result = uut.getChapter(
        '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
        'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
      );

      await expect(result).rejects.toThrowError(error);
    });
  });

  describe('updateChapterMetadata', () => {
    it('should update only the given fields and return the mapped chapter', async () => {
      const { novel1Chapter1 } = getMockedData();
      vi.mocked(prismaService.chapter.update).mockResolvedValue({
        ...novel1Chapter1,
        title: 'A New Dawn',
      } as any);

      const result = await uut.updateChapterMetadata(
        novel1Chapter1.id,
        { title: 'A New Dawn' },
      );

      expect(prismaService.chapter.update).toHaveBeenCalledWith({
        where: { id: novel1Chapter1.id },
        data: { title: 'A New Dawn' },
      });
      expect(result.title).toBe('A New Dawn');
    });
  });

  describe('updateChapterNarrationUrl', () => {
    it('should update chapter narration url', async () => {
      const { novel1Chapter1 } = getMockedData();
      vi.mocked(prismaService.chapter.update).mockResolvedValue({
        ...novel1Chapter1,
        narrationUrl:
          'http://localhost:9000/smart-novel/narrations/chapter-a3987a2f-eaa5-4a05-8714-34a110511cba.mp3',
      } as any);

      await uut.updateChapterNarrationUrl(
        novel1Chapter1.id,
        'http://localhost:9000/smart-novel/narrations/chapter-a3987a2f-eaa5-4a05-8714-34a110511cba.mp3',
      );

      expect(prismaService.chapter.update).toHaveBeenCalledWith({
        where: { id: novel1Chapter1.id },
        data: {
          narrationUrl:
            'http://localhost:9000/smart-novel/narrations/chapter-a3987a2f-eaa5-4a05-8714-34a110511cba.mp3',
        },
      });
    });
  });

  describe('updateNarrationStatus', () => {
    it('should update chapter narration status', async () => {
      const { novel1Chapter1 } = getMockedData();
      vi.mocked(prismaService.chapter.update).mockResolvedValue({
        ...novel1Chapter1,
        narrationStatus: NarrationStatus.PROCESSING,
      } as any);

      await uut.updateNarrationStatus(
        novel1Chapter1.id,
        NarrationStatus.PROCESSING,
      );

      expect(prismaService.chapter.update).toHaveBeenCalledWith({
        where: { id: novel1Chapter1.id },
        data: { narrationStatus: NarrationStatus.PROCESSING },
      });
    });

    it('should update narration status to FAILED', async () => {
      const { novel1Chapter1 } = getMockedData();
      const mockUpdatedChapter = {
        ...novel1Chapter1,
        narrationStatus: NarrationStatus.FAILED,
      };
      vi.mocked(prismaService.chapter.update).mockResolvedValue(
        mockUpdatedChapter as any,
      );

      await uut.updateNarrationStatus(
        novel1Chapter1.id,
        NarrationStatus.FAILED,
      );

      expect(prismaService.chapter.update).toHaveBeenCalledWith({
        where: { id: novel1Chapter1.id },
        data: { narrationStatus: NarrationStatus.FAILED },
      });
    });
  });

  describe('updateChapterNarrationComplete', () => {
    it('should update chapter narration when status is PROCESSING', async () => {
      const chapterId = 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c';
      vi.mocked(prismaService.chapter.updateMany).mockResolvedValue({
        count: 1,
      } as any);

      const result = await uut.updateChapterNarrationComplete(
        chapterId,
        'http://localhost:9000/smart-novel/narrations/chapter-a3987a2f-eaa5-4a05-8714-34a110511cba.mp3',
      );

      expect(result).toBe(1);
      expect(prismaService.chapter.updateMany).toHaveBeenCalledWith({
        where: {
          id: chapterId,
          narrationStatus: NarrationStatus.PROCESSING,
        },
        data: {
          narrationUrl:
            'http://localhost:9000/smart-novel/narrations/chapter-a3987a2f-eaa5-4a05-8714-34a110511cba.mp3',
          narrationStatus: NarrationStatus.READY,
        },
      });
    });

    it('should return 0 when no chapters match the condition', async () => {
      const chapterId = 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c';
      vi.mocked(prismaService.chapter.updateMany).mockResolvedValue({
        count: 0,
      } as any);

      const result = await uut.updateChapterNarrationComplete(
        chapterId,
        'http://localhost:9000/smart-novel/narrations/chapter-a3987a2f-eaa5-4a05-8714-34a110511cba.mp3',
      );

      expect(result).toBe(0);
    });
  });

  describe('findChaptersConnection', () => {
    it('should return chapters with default ordering by chapterNumber ASC', async () => {
      const { novel1Chapter1, novel1Chapter2 } = getMockedData();
      vi.mocked(prismaService.chapter.findMany).mockResolvedValue([
        novel1Chapter1,
        novel1Chapter2,
      ] as any);

      const result = await uut.findChaptersConnection({
        novelId: novel1Chapter1.novelId,
      });

      expect(result.items).toHaveLength(2);
      expect(result.items[0].id).toBe(novel1Chapter1.id);
      expect(result.items[1].id).toBe(novel1Chapter2.id);
      expect(prismaService.chapter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            novelId: novel1Chapter1.novelId,
          },
          orderBy: { chapterNumber: 'asc' },
        }),
      );
    });

    it('should apply narrationStatus filter', async () => {
      vi.mocked(prismaService.chapter.findMany).mockResolvedValue(
        [] as any,
      );

      await uut.findChaptersConnection({
        novelId: '86537331-b426-4081-aa4e-e58daf533a97',
        filters: { narrationStatus: NarrationStatus.READY },
      });

      expect(prismaService.chapter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            novelId: '86537331-b426-4081-aa4e-e58daf533a97',
            narrationStatus: NarrationStatus.READY,
          },
        }),
      );
    });

    it('should order by createdAt DESC when specified', async () => {
      vi.mocked(prismaService.chapter.findMany).mockResolvedValue(
        [] as any,
      );

      await uut.findChaptersConnection({
        novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
        orderByField: ChapterOrderField.CREATED_AT,
        orderByDirection: OrderDirection.DESC,
      });

      expect(prismaService.chapter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should apply forward pagination with first and after', async () => {
      const { novel1Chapter2 } = getMockedData();
      vi.mocked(prismaService.chapter.findMany).mockResolvedValue([
        novel1Chapter2,
      ] as any);
      const afterCursor =
        'YmI1NjNhZDUtMWFjNC00NmMyLWEyNWYtNmY2MmQyNDVmNDRj'; // Base64 for 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c'

      const result = await uut.findChaptersConnection({
        novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
        pagination: { first: 10, after: afterCursor },
      });

      expect(result.items).toHaveLength(1);
      expect(prismaService.chapter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c' },
          skip: 1,
          take: 11,
        }),
      );
    });

    it('should trim extra record and signal hasMore when chapters exceed take', async () => {
      const { novel1Chapter1, novel1Chapter2, novel1Chapter3 } =
        getMockedData();
      vi.mocked(prismaService.chapter.findMany).mockResolvedValue([
        novel1Chapter1,
        novel1Chapter2,
        novel1Chapter3,
      ] as any);

      const result = await uut.findChaptersConnection({
        novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
        pagination: { first: 2 },
      });

      expect(result.items).toHaveLength(2);
      expect(result.hasMore).toBe(true);
      expect(result.items[0].id).toBe(novel1Chapter1.id);
      expect(result.items[1].id).toBe(novel1Chapter2.id);
    });

    it('should return empty result when novel has no chapters', async () => {
      vi.mocked(prismaService.chapter.findMany).mockResolvedValue(
        [] as any,
      );

      const result = await uut.findChaptersConnection({
        novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
      });

      expect(result.items).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('countChapters', () => {
    it('should return count with no filters', async () => {
      vi.mocked(prismaService.chapter.count).mockResolvedValue(5);

      const result = await uut.countChapters(
        '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
      );

      expect(result).toBe(5);
      expect(prismaService.chapter.count).toHaveBeenCalledWith({
        where: { novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec' },
      });
    });

    it('should apply narrationStatus filter', async () => {
      vi.mocked(prismaService.chapter.count).mockResolvedValue(2);

      await uut.countChapters(
        '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
        { narrationStatus: NarrationStatus.READY },
      );

      expect(prismaService.chapter.count).toHaveBeenCalledWith({
        where: {
          novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
          narrationStatus: NarrationStatus.READY,
        },
      });
    });
  });

  describe('getFirstChapter', () => {
    it('should return the first chapter ordered by chapterNumber ASC', async () => {
      const { novel1Chapter1 } = getMockedData();
      vi.mocked(prismaService.chapter.findFirst).mockResolvedValue(
        novel1Chapter1 as any,
      );

      const result = await uut.getFirstChapter(
        novel1Chapter1.novelId,
      );

      expect(result).toStrictEqual({
        id: novel1Chapter1.id,
        novelId: novel1Chapter1.novelId,
        contentId: novel1Chapter1.contentId,
        title: novel1Chapter1.title,
        chapterNumber: novel1Chapter1.chapterNumber,
        createdAt: novel1Chapter1.createdAt.toISOString(),
        updatedAt: novel1Chapter1.updatedAt.toISOString(),
        narrationStatus: novel1Chapter1.narrationStatus,
        narrationUrl: 'https://example.com/narration.mp3',
      });
      expect(prismaService.chapter.findFirst).toHaveBeenCalledWith({
        where: {
          novelId: novel1Chapter1.novelId,
        },
        orderBy: { chapterNumber: 'asc' },
      });
    });

    it('should return null when novel has no chapters', async () => {
      vi.mocked(prismaService.chapter.findFirst).mockResolvedValue(
        null,
      );

      const result = await uut.getFirstChapter(
        'non-existent-novel-id',
      );

      expect(result).toBeNull();
    });

    it('should throw when database fails', async () => {
      const error = new Error('Database error');
      vi.mocked(prismaService.chapter.findFirst).mockRejectedValue(
        error,
      );

      const result = uut.getFirstChapter(
        '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
      );

      await expect(result).rejects.toThrowError(error);
    });
  });

  describe('findManyBy', () => {
    it('should return chapters by IDs', async () => {
      const { novel1Chapter1, novel1Chapter2 } = getMockedData();
      vi.mocked(prismaService.chapter.findMany).mockResolvedValue([
        novel1Chapter1,
        novel1Chapter2,
      ] as any);
      const chapterIds = [novel1Chapter1.id, novel1Chapter2.id];

      const result = await uut.findManyBy(chapterIds);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(novel1Chapter1.id);
      expect(result[1].id).toBe(novel1Chapter2.id);
      expect(prismaService.chapter.findMany).toHaveBeenCalledWith({
        where: { id: { in: chapterIds } },
        select: {
          id: true,
          novelId: true,
          contentId: true,
          title: true,
          chapterNumber: true,
          narrationStatus: true,
          narrationUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    it('should return empty array when no chapters found', async () => {
      vi.mocked(prismaService.chapter.findMany).mockResolvedValue([]);
      const chapterIds = ['non-existent-id'];

      const result = await uut.findManyBy(chapterIds);

      expect(result).toStrictEqual([]);
    });

    it('should throw when database fails', async () => {
      const error = new Error('Database error');
      vi.mocked(prismaService.chapter.findMany).mockRejectedValue(
        error,
      );
      const chapterIds = ['bb563ad5-1ac4-46c2-a25f-6f62d245f44c'];

      const result = uut.findManyBy(chapterIds);

      await expect(result).rejects.toThrowError(error);
    });
  });

  describe('getLastChapter', () => {
    it('should return the last chapter ordered by chapterNumber DESC', async () => {
      const { novel1Chapter2 } = getMockedData();
      vi.mocked(prismaService.chapter.findFirst).mockResolvedValue(
        novel1Chapter2 as any,
      );

      const result = await uut.getLastChapter(
        '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
      );

      expect(result).toStrictEqual({
        id: '904bf826-33be-4172-b63f-665bba9007b9',
        novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
        contentId: 'ddd63ad5-1ac4-46c2-a25f-6f62d245f44c',
        title: 'Chapter 2: The Journey',
        chapterNumber: 2,
        createdAt: '2024-01-03T00:00:00.000Z',
        updatedAt: '2024-01-04T00:00:00.000Z',
        narrationStatus: NarrationStatus.PROCESSING,
        narrationUrl: undefined,
      });
      expect(prismaService.chapter.findFirst).toHaveBeenCalledWith({
        where: {
          novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
        },
        orderBy: { chapterNumber: 'desc' },
      });
    });

    it('should return null when novel has no chapters', async () => {
      vi.mocked(prismaService.chapter.findFirst).mockResolvedValue(
        null,
      );

      const result = await uut.getLastChapter(
        '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
      );

      expect(result).toBeNull();
    });

    it('should throw when database fails', async () => {
      const error = new Error('Database error');
      vi.mocked(prismaService.chapter.findFirst).mockRejectedValue(
        error,
      );

      const result = uut.getLastChapter(
        '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
      );

      await expect(result).rejects.toThrowError(error);
    });
  });
});

function getMockedData() {
  const novel1 = {
    id: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
    name: 'Test Novel',
    author: 'John Doe',
    description: 'A test novel description',
    state: 'ONGOING',
    coverUrl: 'https://example.com/cover.jpg',
    categories: [
      { category: { name: 'Fantasy' } },
      { category: { name: 'Adventure' } },
    ],
    chapters: [
      { id: 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c' },
      { id: '904bf826-33be-4172-b63f-665bba9007b9' },
    ],
  };
  const novel1Chapter1 = {
    id: 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
    novelId: novel1.id,
    title: 'Chapter 1: The Beginning',
    contentId: 'ccc63ad5-1ac4-46c2-a25f-6f62d245f44c',
    chapterNumber: 1,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
    narrationStatus: 'READY',
    narrationUrl: 'https://example.com/narration.mp3',
  };
  const novel1Chapter2 = {
    id: '904bf826-33be-4172-b63f-665bba9007b9',
    novelId: novel1.id,
    title: 'Chapter 2: The Journey',
    contentId: 'ddd63ad5-1ac4-46c2-a25f-6f62d245f44c',
    chapterNumber: 2,
    createdAt: new Date('2024-01-03T00:00:00Z'),
    updatedAt: new Date('2024-01-04T00:00:00Z'),
    narrationStatus: 'PROCESSING',
    narrationUrl: null,
  };
  const novel1Chapter3 = {
    id: '041be636-8bd3-44b4-a22c-29703b2b63e5',
    novelId: novel1.id,
    title: 'Chapter 3: The Return',
    contentId: 'eee63ad5-1ac4-46c2-a25f-6f62d245f44c',
    chapterNumber: 3,
    createdAt: new Date('2024-01-05T00:00:00Z'),
    updatedAt: new Date('2024-01-06T00:00:00Z'),
    narrationStatus: null,
    narrationUrl: null,
  };
  const novel2 = {
    id: '860365b9-e3f2-4cf4-a363-f9198eec77f5',
    name: 'Another Novel',
    author: 'Jane Smith',
    description: 'Another novel description',
    state: 'COMPLETED',
    coverUrl: 'https://example.com/another-cover.jpg',
    categories: [{ category: { name: 'Sci-Fi' } }],
    chapters: [{ id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }],
  };
  const novel2Chapter1 = {
    id: 'fcac9aec-4cdf-48a0-a66f-85c740314da6',
    novelId: novel2.id,
    title: 'Chapter 1: The Future',
    contentId: 'fff63ad5-1ac4-46c2-a25f-6f62d245f44c',
    chapterNumber: 1,
    createdAt: new Date('2024-02-01T00:00:00Z'),
    updatedAt: new Date('2024-02-02T00:00:00Z'),
    narrationStatus: 'READY',
    narrationUrl: 'https://example.com/other-narration.mp3',
  };

  return {
    novel1,
    novel1Chapter1,
    novel1Chapter2,
    novel1Chapter3,
    novel2,
    novel2Chapter1,
  };
}

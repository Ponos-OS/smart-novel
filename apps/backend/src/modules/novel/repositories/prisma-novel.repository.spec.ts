import { NovelState } from '@prisma/client';

import { PrismaService } from '../../prisma';
import { PrismaNovelRepository } from './prisma-novel.repository';

describe(PrismaNovelRepository.name, () => {
  let uut: PrismaNovelRepository;
  let prismaService: PrismaService;

  beforeEach(async () => {
    // Mock PrismaService with all required methods
    prismaService = {
      novel: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      chapterContent: { deleteMany: vi.fn() },
      $queryRaw: vi.fn(),
      chapter: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      category: {
        findMany: vi.fn(),
        createMany: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(prismaService)),
    } as any;

    uut = new PrismaNovelRepository(prismaService);
  });

  describe('createNovel', () => {
    const novelRecord = {
      id: '78981754-46c4-4521-9216-b9b27dafeab2',
      ownerId: '260311094522198751',
      name: 'The Journey Begins',
      author: 'Jane Doe',
      description: 'A young hero leaves home.',
      state: NovelState.ONGOING,
      coverUrl: null,
      categories: [{ category: { name: 'fantasy' } }],
    };

    it('should link existing categories and create the missing ones', async () => {
      vi.mocked(prismaService.category.findMany)
        .mockResolvedValueOnce([
          {
            id: '6e0b6b86-8b2d-4d9a-8d7e-0c1a2b3c4d5e',
            name: 'Fantasy',
          },
        ] as any)
        .mockResolvedValueOnce([
          { id: 'a5b1f3c2-71d4-4f0e-9a3b-2d6c8e1f7a90' },
        ] as any);
      vi.mocked(prismaService.novel.create).mockResolvedValue(
        novelRecord as any,
      );

      const result = await uut.createNovel({
        ownerId: '260311094522198751',
        name: 'The Journey Begins',
        author: 'Jane Doe',
        description: 'A young hero leaves home.',
        categories: ['fantasy', 'sci-fi'],
      });

      expect(prismaService.category.createMany).toHaveBeenCalledWith({
        data: [{ name: 'sci-fi' }],
        skipDuplicates: true,
      });
      expect(prismaService.novel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            ownerId: '260311094522198751',
            name: 'The Journey Begins',
            author: 'Jane Doe',
            description: 'A young hero leaves home.',
            categories: {
              create: [
                {
                  categoryId: '6e0b6b86-8b2d-4d9a-8d7e-0c1a2b3c4d5e',
                },
                {
                  categoryId: 'a5b1f3c2-71d4-4f0e-9a3b-2d6c8e1f7a90',
                },
              ],
            },
          },
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: novelRecord.id,
          ownerId: '260311094522198751',
          category: ['fantasy'],
        }),
      );
    });

    it('should not touch the categories table when none are passed', async () => {
      vi.mocked(prismaService.novel.create).mockResolvedValue({
        ...novelRecord,
        categories: [],
      } as any);

      await uut.createNovel({
        ownerId: '260311094522198751',
        name: 'The Journey Begins',
        author: 'Jane Doe',
        description: 'A young hero leaves home.',
      });

      expect(prismaService.category.findMany).not.toHaveBeenCalled();
      expect(
        prismaService.category.createMany,
      ).not.toHaveBeenCalled();
    });
  });

  describe('updateNovel', () => {
    const novelId = '78981754-46c4-4521-9216-b9b27dafeab2';
    const novelRecord = {
      id: novelId,
      ownerId: '260311094522198751',
      name: 'Renamed',
      author: 'Jane Doe',
      description: 'A young hero leaves home.',
      state: NovelState.FINISHED,
      coverUrl: null,
      categories: [],
    };

    it('should only send the passed fields and keep the categories when they are omitted', async () => {
      vi.mocked(prismaService.novel.update).mockResolvedValue(
        novelRecord as any,
      );

      await uut.updateNovel(novelId, { name: 'Renamed' });

      expect(prismaService.novel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: novelId },
          data: {
            name: 'Renamed',
            author: undefined,
            description: undefined,
            state: undefined,
            categories: undefined,
          },
        }),
      );
      expect(prismaService.category.findMany).not.toHaveBeenCalled();
    });

    it('should replace the categories when they are passed', async () => {
      vi.mocked(prismaService.category.findMany).mockResolvedValue([
        {
          id: '6e0b6b86-8b2d-4d9a-8d7e-0c1a2b3c4d5e',
          name: 'adventure',
        },
      ] as any);
      vi.mocked(prismaService.novel.update).mockResolvedValue(
        novelRecord as any,
      );

      await uut.updateNovel(novelId, { categories: ['adventure'] });

      expect(prismaService.novel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            categories: {
              deleteMany: {},
              create: [
                {
                  categoryId: '6e0b6b86-8b2d-4d9a-8d7e-0c1a2b3c4d5e',
                },
              ],
            },
          }),
        }),
      );
    });

    it('should clear the categories when an empty list is passed', async () => {
      vi.mocked(prismaService.novel.update).mockResolvedValue(
        novelRecord as any,
      );

      await uut.updateNovel(novelId, { categories: [] });

      expect(prismaService.novel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            categories: { deleteMany: {}, create: [] },
          }),
        }),
      );
    });
  });

  describe('setCoverUrl', () => {
    it('should store the new cover URL and return the one it replaced', async () => {
      const novelId = '78981754-46c4-4521-9216-b9b27dafeab2';
      vi.mocked(
        prismaService.novel.findUniqueOrThrow,
      ).mockResolvedValue({
        coverUrl:
          'http://s3.localhost:8080/smart-novel/covers/old.png',
      } as any);
      vi.mocked(prismaService.novel.update).mockResolvedValue({
        id: novelId,
        ownerId: '260311094522198751',
        name: 'The Journey Begins',
        author: 'Jane Doe',
        description: 'A young hero leaves home.',
        state: NovelState.ONGOING,
        coverUrl:
          'http://s3.localhost:8080/smart-novel/covers/new.png',
        categories: [],
      } as any);

      const result = await uut.setCoverUrl(
        novelId,
        'http://s3.localhost:8080/smart-novel/covers/new.png',
      );

      expect(prismaService.novel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: novelId },
          data: {
            coverUrl:
              'http://s3.localhost:8080/smart-novel/covers/new.png',
          },
        }),
      );
      expect(result.previousCoverUrl).toBe(
        'http://s3.localhost:8080/smart-novel/covers/old.png',
      );
      expect(result.novel.coverUrl).toBe(
        'http://s3.localhost:8080/smart-novel/covers/new.png',
      );
    });

    it('should report no previous cover when the novel had none', async () => {
      vi.mocked(
        prismaService.novel.findUniqueOrThrow,
      ).mockResolvedValue({
        coverUrl: null,
      } as any);
      vi.mocked(prismaService.novel.update).mockResolvedValue({
        id: '78981754-46c4-4521-9216-b9b27dafeab2',
        ownerId: '260311094522198751',
        name: 'The Journey Begins',
        author: 'Jane Doe',
        description: 'A young hero leaves home.',
        state: NovelState.ONGOING,
        coverUrl:
          'http://s3.localhost:8080/smart-novel/covers/new.png',
        categories: [],
      } as any);

      const result = await uut.setCoverUrl(
        '78981754-46c4-4521-9216-b9b27dafeab2',
        'http://s3.localhost:8080/smart-novel/covers/new.png',
      );

      expect(result.previousCoverUrl).toBeUndefined();
    });
  });

  describe('deleteNovel', () => {
    const novelId = '78981754-46c4-4521-9216-b9b27dafeab2';

    it('should lock the novel, delete it and then its chapter contents, returning what object storage must drop', async () => {
      vi.mocked(prismaService.novel.findUnique).mockResolvedValue({
        coverUrl: `http://localhost:9000/smart-novel/covers/${novelId}/5c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f.png`,
        chapters: [
          {
            contentId: 'ccc63ad5-1ac4-46c2-a25f-6f62d245f44c',
            narrationUrl:
              'http://localhost:9000/smart-novel/narrations/0b6b3d0e-5d0e-4d58-9f0b-3f1c7d6a2e11.mp3',
          },
          {
            contentId: 'fdba9d1b-32db-4b18-85c4-a5f2e680dcec',
            narrationUrl: null,
          },
        ],
      } as any);

      const result = await uut.deleteNovel(novelId);

      expect(prismaService.$queryRaw).toHaveBeenCalledOnce();
      expect(prismaService.novel.delete).toHaveBeenCalledWith({
        where: { id: novelId },
      });
      expect(
        prismaService.chapterContent.deleteMany,
      ).toHaveBeenCalledWith({
        where: {
          id: {
            in: [
              'ccc63ad5-1ac4-46c2-a25f-6f62d245f44c',
              'fdba9d1b-32db-4b18-85c4-a5f2e680dcec',
            ],
          },
        },
      });
      expect(result).toEqual({
        id: novelId,
        coverUrl: `http://localhost:9000/smart-novel/covers/${novelId}/5c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f.png`,
        narrationUrls: [
          'http://localhost:9000/smart-novel/narrations/0b6b3d0e-5d0e-4d58-9f0b-3f1c7d6a2e11.mp3',
        ],
      });
    });

    it('should return null and delete nothing when the novel does not exist', async () => {
      vi.mocked(prismaService.novel.findUnique).mockResolvedValue(
        null,
      );

      const result = await uut.deleteNovel(novelId);

      expect(result).toBeNull();
      expect(prismaService.novel.delete).not.toHaveBeenCalled();
      expect(
        prismaService.chapterContent.deleteMany,
      ).not.toHaveBeenCalled();
    });
  });

  describe('findNovelsConnection', () => {
    it('should return novels when no filters or pagination are provided', async () => {
      const { novel } = getMockedData();
      vi.mocked(prismaService.novel.findMany).mockResolvedValue([
        novel,
      ] as any);

      const result = await uut.findNovelsConnection({});

      expect(result).toEqual({
        items: [
          {
            id: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
            name: 'Test Novel',
            author: 'John Doe',
            description: 'A test novel description',
            state: NovelState.ONGOING,
            ownerId: '230104087265432001',
            coverUrl: 'https://example.com/cover.jpg',
            category: ['fantasy', 'adventure'],
          },
        ],
        hasMore: false,
      });
      expect(prismaService.novel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          orderBy: { name: 'asc' },
        }),
      );
    });

    it('should return empty result when no novels exist', async () => {
      vi.mocked(prismaService.novel.findMany).mockResolvedValue([]);

      const result = await uut.findNovelsConnection({});

      expect(result).toEqual({ items: [], hasMore: false });
    });

    it('should handle novels with null coverUrl', async () => {
      const { novel } = getMockedData();
      const novelWithoutCover = { ...novel, coverUrl: null };
      vi.mocked(prismaService.novel.findMany).mockResolvedValue([
        novelWithoutCover,
      ] as any);

      const result = await uut.findNovelsConnection({});

      expect(result.items[0].coverUrl).toBeUndefined();
    });

    it('should apply categoryIn filter', async () => {
      vi.mocked(prismaService.novel.findMany).mockResolvedValue([]);

      await uut.findNovelsConnection({
        filters: { categoryIn: ['Fantasy'] },
      });

      expect(prismaService.novel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            categories: {
              some: {
                category: {
                  name: { in: ['Fantasy'], mode: 'insensitive' },
                },
              },
            },
          },
        }),
      );
    });

    it('should apply categoryNin filter', async () => {
      vi.mocked(prismaService.novel.findMany).mockResolvedValue(
        [] as any,
      );

      await uut.findNovelsConnection({
        filters: { categoryNin: ['Horror'] },
      });

      expect(prismaService.novel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            NOT: {
              categories: {
                some: {
                  category: {
                    name: { in: ['Horror'], mode: 'insensitive' },
                  },
                },
              },
            },
          },
        }),
      );
    });

    it('should apply forward pagination with first and after', async () => {
      const { novel } = getMockedData();
      vi.mocked(prismaService.novel.findMany).mockResolvedValue([
        novel,
      ] as any);
      const afterCursor = Buffer.from(
        '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
      ).toString('base64');

      await uut.findNovelsConnection({
        pagination: { first: 10, after: afterCursor },
      });

      expect(prismaService.novel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec' },
          skip: 1,
          take: 11,
        }),
      );
    });

    it('should propagate the error when database fails', async () => {
      vi.mocked(prismaService.novel.findMany).mockRejectedValue(
        new Error('Database connection failed'),
      );

      const result = uut.findNovelsConnection({});

      await expect(result).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  describe('countNovels', () => {
    it('should return count with no filters', async () => {
      vi.mocked(prismaService.novel.count).mockResolvedValue(5);

      const result = await uut.countNovels();

      expect(result).toBe(5);
      expect(prismaService.novel.count).toHaveBeenCalledWith({
        where: {},
      });
    });

    it('should apply categoryIn filter', async () => {
      vi.mocked(prismaService.novel.count).mockResolvedValue(2);

      await uut.countNovels({ categoryIn: ['Fantasy'] });

      expect(prismaService.novel.count).toHaveBeenCalledWith({
        where: {
          categories: {
            some: {
              category: {
                name: { in: ['Fantasy'], mode: 'insensitive' },
              },
            },
          },
        },
      });
    });

    it('should apply categoryNin filter', async () => {
      vi.mocked(prismaService.novel.count).mockResolvedValue(3);

      await uut.countNovels({ categoryNin: ['Horror'] });

      expect(prismaService.novel.count).toHaveBeenCalledWith({
        where: {
          NOT: {
            categories: {
              some: {
                category: {
                  name: { in: ['Horror'], mode: 'insensitive' },
                },
              },
            },
          },
        },
      });
    });
  });

  describe('findById', () => {
    it('should return novel by id with transformed data', async () => {
      const { novel } = getMockedData();
      vi.mocked(prismaService.novel.findUnique).mockResolvedValue(
        novel as any,
      );

      const result = await uut.findById(
        '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
      );

      expect(result).toEqual({
        id: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
        name: 'Test Novel',
        author: 'John Doe',
        description: 'A test novel description',
        state: NovelState.ONGOING,
        ownerId: '230104087265432001',
        coverUrl: 'https://example.com/cover.jpg',
        category: ['fantasy', 'adventure'],
      });
      expect(prismaService.novel.findUnique).toHaveBeenCalledWith({
        where: { id: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec' },
        include: {
          categories: {
            select: {
              category: {
                select: { name: true },
              },
            },
          },
        },
      });
    });

    it('should return null when novel is not found', async () => {
      vi.mocked(prismaService.novel.findUnique).mockResolvedValue(
        null,
      );

      const result = await uut.findById('non-existent');

      expect(result).toBeNull();
    });

    it('should propagate the error when database fails', async () => {
      vi.mocked(prismaService.novel.findUnique).mockRejectedValue(
        new Error('Database error'),
      );

      const result = uut.findById(
        '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
      );

      await expect(result).rejects.toThrow('Database error');
    });
  });

  describe('getCategories', () => {
    it('should return lowercased category names', async () => {
      const mockCategories = [
        { name: 'Fantasy' },
        { name: 'Adventure' },
        { name: 'SCI-FI' },
      ];
      vi.mocked(prismaService.category.findMany).mockResolvedValue(
        mockCategories as any,
      );

      const result = await uut.getCategories();

      expect(result).toEqual(['fantasy', 'adventure', 'sci-fi']);
      expect(prismaService.category.findMany).toHaveBeenCalledWith({
        select: { name: true },
        orderBy: { name: 'asc' },
      });
    });

    it('should return empty array when no categories exist', async () => {
      vi.mocked(prismaService.category.findMany).mockResolvedValue(
        [],
      );

      const result = await uut.getCategories();

      expect(result).toEqual([]);
    });

    it('should propagate the error when database fails', async () => {
      vi.mocked(prismaService.category.findMany).mockRejectedValue(
        new Error('Database error'),
      );

      const result = uut.getCategories();

      await expect(result).rejects.toThrow('Database error');
    });
  });
});

function getMockedData() {
  const novel = {
    id: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
    name: 'Test Novel',
    author: 'John Doe',
    description: 'A test novel description',
    state: 'ONGOING',
    ownerId: '230104087265432001',
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
  const chapter = {
    id: 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
    novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
    title: 'Chapter 1: The Beginning',
    content: '# Chapter 1\n\nThis is the content.',
    chapterNumber: 1,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
    narrationStatus: 'READY',
    narrationUrl: 'https://example.com/narration.mp3',
  };

  return { novel, chapter };
}

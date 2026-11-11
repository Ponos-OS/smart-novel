import { NovelState } from '@prisma/client';

import { OrderDirection } from '../../../shared';
import { PrismaService } from '../../prisma';
import { NovelOrderField } from '../enums';
import { PrismaNovelRepository } from './prisma-novel.repository';

describe(PrismaNovelRepository.name, () => {
  let uut: PrismaNovelRepository;
  let prismaService: PrismaService;
  let logger: {
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };
  const writerId = '5b2c0f3e-0a53-4d3c-9d2c-9a3d1f7f4a10';

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
      writer: { findUnique: vi.fn() },
      chapterContent: { deleteMany: vi.fn() },
      $queryRaw: vi.fn(),
      chapter: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      tag: {
        findMany: vi.fn(),
        createMany: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(prismaService)),
    } as any;

    logger = { error: vi.fn(), warn: vi.fn() };
    uut = new PrismaNovelRepository(prismaService, logger as never);
    vi.mocked(prismaService.writer.findUnique).mockResolvedValue({
      id: writerId,
    } as never);
  });

  describe('createNovel', () => {
    const licenseId = '3f7b0c1e-6d52-4b8a-9a41-5c2e8d7f1a06';

    const novelRecord = {
      id: '78981754-46c4-4521-9216-b9b27dafeab2',
      writerId,
      writer: { userId: '260311094522198751' },
      licenseId,
      name: 'The Journey Begins',
      description: 'A young hero leaves home.',
      state: NovelState.ONGOING,
      coverUrl: null,
      tags: [{ tag: { name: 'fantasy' } }],
    };

    it('should link the approved tags', async () => {
      vi.mocked(prismaService.tag.findMany).mockResolvedValue([
        {
          id: '6e0b6b86-8b2d-4d9a-8d7e-0c1a2b3c4d5e',
          name: 'Fantasy',
        },
        {
          id: 'a5b1f3c2-71d4-4f0e-9a3b-2d6c8e1f7a90',
          name: 'sci-fi',
        },
      ] as any);
      vi.mocked(prismaService.novel.create).mockResolvedValue(
        novelRecord as any,
      );

      const result = await uut.createNovel({
        ownerId: '260311094522198751',
        licenseId,
        name: 'The Journey Begins',
        description: 'A young hero leaves home.',
        tags: ['fantasy', 'sci-fi'],
      });

      expect(prismaService.tag.findMany).toHaveBeenCalledWith({
        where: {
          name: { in: ['fantasy', 'sci-fi'] },
          status: 'APPROVED',
        },
        select: { id: true, name: true },
      });
      expect(prismaService.tag.createMany).not.toHaveBeenCalled();
      expect(prismaService.novel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            writerId,
            licenseId,
            name: 'The Journey Begins',
            description: 'A young hero leaves home.',
            tags: {
              create: [
                {
                  tagId: '6e0b6b86-8b2d-4d9a-8d7e-0c1a2b3c4d5e',
                },
                {
                  tagId: 'a5b1f3c2-71d4-4f0e-9a3b-2d6c8e1f7a90',
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
          writerId,
          licenseId,
          tags: ['fantasy'],
        }),
      );
    });

    it('should look the writer up by the user ID and reference the row', async () => {
      vi.mocked(prismaService.tag.findMany).mockResolvedValue(
        [] as any,
      );
      vi.mocked(prismaService.novel.create).mockResolvedValue(
        novelRecord as any,
      );

      await uut.createNovel({
        ownerId: '260311094522198751',
        licenseId,
        name: 'The Journey Begins',
        description: 'A young hero leaves home.',
      });

      expect(prismaService.writer.findUnique).toHaveBeenCalledWith({
        where: { userId: '260311094522198751' },
        select: { id: true },
      });
    });

    it('should fail loudly and log it when the caller has no writer row', async () => {
      vi.mocked(prismaService.tag.findMany).mockResolvedValue(
        [] as any,
      );
      vi.mocked(prismaService.writer.findUnique).mockResolvedValue(
        null,
      );

      const result = uut.createNovel({
        ownerId: '260311094522198751',
        licenseId,
        name: 'The Journey Begins',
        description: 'A young hero leaves home.',
      });

      await expect(result).rejects.toThrow('Writer integrity error');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('260311094522198751'),
      );
      expect(prismaService.novel.create).not.toHaveBeenCalled();
    });

    it('should reject tags that are not approved, naming them', async () => {
      vi.mocked(prismaService.tag.findMany).mockResolvedValue([
        {
          id: '6e0b6b86-8b2d-4d9a-8d7e-0c1a2b3c4d5e',
          name: 'fantasy',
        },
      ] as any);

      const result = uut.createNovel({
        ownerId: '260311094522198751',
        licenseId,
        name: 'The Journey Begins',
        description: 'A young hero leaves home.',
        tags: ['fantasy', 'slice of life', 'steampunk'],
      });

      await expect(result).rejects.toThrow(
        'These tags are not available: slice of life, steampunk.',
      );
      expect(prismaService.novel.create).not.toHaveBeenCalled();
    });

    it('should not touch the tags table when none are passed', async () => {
      vi.mocked(prismaService.novel.create).mockResolvedValue({
        ...novelRecord,
        tags: [],
      } as any);

      await uut.createNovel({
        ownerId: '260311094522198751',
        licenseId,
        name: 'The Journey Begins',
        description: 'A young hero leaves home.',
      });

      expect(prismaService.tag.findMany).not.toHaveBeenCalled();
      expect(prismaService.tag.createMany).not.toHaveBeenCalled();
    });
  });

  describe('updateNovel', () => {
    const novelId = '78981754-46c4-4521-9216-b9b27dafeab2';
    const novelRecord = {
      id: novelId,
      writerId,
      writer: { userId: '260311094522198751' },
      name: 'Renamed',
      description: 'A young hero leaves home.',
      state: NovelState.FINISHED,
      coverUrl: null,
      tags: [],
    };

    it('should only send the passed fields and keep the tags when they are omitted', async () => {
      vi.mocked(prismaService.novel.update).mockResolvedValue(
        novelRecord as any,
      );

      await uut.updateNovel(novelId, { name: 'Renamed' });

      expect(prismaService.novel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: novelId },
          data: {
            name: 'Renamed',
            description: undefined,
            state: undefined,
            tags: undefined,
          },
        }),
      );
      expect(prismaService.tag.findMany).not.toHaveBeenCalled();
    });

    it('should replace the tags when they are passed', async () => {
      vi.mocked(prismaService.tag.findMany).mockResolvedValue([
        {
          id: '6e0b6b86-8b2d-4d9a-8d7e-0c1a2b3c4d5e',
          name: 'adventure',
        },
      ] as any);
      vi.mocked(prismaService.novel.update).mockResolvedValue(
        novelRecord as any,
      );

      await uut.updateNovel(novelId, { tags: ['adventure'] });

      expect(prismaService.novel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tags: {
              deleteMany: {},
              create: [
                {
                  tagId: '6e0b6b86-8b2d-4d9a-8d7e-0c1a2b3c4d5e',
                },
              ],
            },
          }),
        }),
      );
    });

    it('should clear the tags when an empty list is passed', async () => {
      vi.mocked(prismaService.novel.update).mockResolvedValue(
        novelRecord as any,
      );

      await uut.updateNovel(novelId, { tags: [] });

      expect(prismaService.novel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tags: { deleteMany: {}, create: [] },
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
        writerId,
        writer: { userId: '260311094522198751' },
        name: 'The Journey Begins',
        description: 'A young hero leaves home.',
        state: NovelState.ONGOING,
        coverUrl:
          'http://s3.localhost:8080/smart-novel/covers/new.png',
        tags: [],
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
        writerId,
        writer: { userId: '260311094522198751' },
        name: 'The Journey Begins',
        description: 'A young hero leaves home.',
        state: NovelState.ONGOING,
        coverUrl:
          'http://s3.localhost:8080/smart-novel/covers/new.png',
        tags: [],
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

  describe('findNovelsPage', () => {
    const page = { shouldReverse: false, take: 21 };
    const order = {
      field: NovelOrderField.NAME,
      direction: OrderDirection.ASC,
    };
    const lastQuery = () => {
      const calls = vi.mocked(prismaService.$queryRaw).mock.calls;
      const { text, values } = calls[calls.length - 1][0] as any;

      return { sql: text.replace(/\s+/g, ' '), values };
    };

    it('should read the ids of the page by name, then load those novels with their tags', async () => {
      const { novel } = getMockedData();
      vi.mocked(prismaService.$queryRaw).mockResolvedValue([
        { id: novel.id },
      ]);
      vi.mocked(prismaService.novel.findMany).mockResolvedValue([
        novel,
      ] as any);

      const result = await uut.findNovelsPage({ page, order });

      const { sql, values } = lastQuery();
      expect(sql).not.toContain('WHERE');
      expect(sql).toContain('ORDER BY n.name ASC, n.id ASC LIMIT $1');
      expect(values).toStrictEqual([21]);
      expect(prismaService.novel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: [novel.id] } },
        }),
      );
      expect(result).toEqual([
        {
          id: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
          name: 'Test Novel',
          description: 'A test novel description',
          state: NovelState.ONGOING,
          ownerId: '230104087265432001',
          writerId: '5b2c0f3e-0a53-4d3c-9d2c-9a3d1f7f4a10',
          coverUrl: 'https://example.com/cover.jpg',
          tags: ['Fantasy', 'Adventure'],
        },
      ]);
    });

    it('should return the novels in the order of the page, not the order the database loaded them in', async () => {
      const { novel } = getMockedData();
      const second = {
        ...novel,
        id: '78981754-46c4-4521-9216-b9b27dafeab2',
      };
      vi.mocked(prismaService.$queryRaw).mockResolvedValue([
        { id: second.id },
        { id: novel.id },
      ]);
      vi.mocked(prismaService.novel.findMany).mockResolvedValue([
        novel,
        second,
      ] as any);

      const result = await uut.findNovelsPage({ page, order });

      expect(result.map(({ id }) => id)).toStrictEqual([
        second.id,
        novel.id,
      ]);
    });

    it('should return an empty result when no novels exist', async () => {
      vi.mocked(prismaService.$queryRaw).mockResolvedValue([]);
      vi.mocked(prismaService.novel.findMany).mockResolvedValue([]);

      const result = await uut.findNovelsPage({ page, order });

      expect(result).toEqual([]);
    });

    it('should leave a missing cover out', async () => {
      const { novel } = getMockedData();
      vi.mocked(prismaService.$queryRaw).mockResolvedValue([
        { id: novel.id },
      ]);
      vi.mocked(prismaService.novel.findMany).mockResolvedValue([
        { ...novel, coverUrl: null },
      ] as any);

      const result = await uut.findNovelsPage({ page, order });

      expect(result[0].coverUrl).toBeUndefined();
    });

    it('should read the opposite order when the page is reversed', async () => {
      vi.mocked(prismaService.$queryRaw).mockResolvedValue([]);
      vi.mocked(prismaService.novel.findMany).mockResolvedValue([]);

      await uut.findNovelsPage({
        page: { shouldReverse: true, take: 3 },
        order,
      });

      expect(lastQuery().sql).toContain(
        'ORDER BY n.name DESC, n.id DESC LIMIT $1',
      );
    });

    it('should put the filters in the query', async () => {
      vi.mocked(prismaService.$queryRaw).mockResolvedValue([]);
      vi.mocked(prismaService.novel.findMany).mockResolvedValue([]);

      await uut.findNovelsPage({
        page,
        order,
        filters: {
          tagIn: ['fantasy'],
          state: NovelState.FINISHED,
        },
      });

      const { sql, values } = lastQuery();
      expect(sql).toContain('WHERE EXISTS (');
      expect(sql).toContain('lower(c.name) = ANY($1::text[])');
      expect(sql).toContain('AND n.state = $2::"NovelState"');
      expect(values).toStrictEqual([
        ['fantasy'],
        NovelState.FINISHED,
        21,
      ]);
    });

    it('should continue after a cursor with a keyset on the sort column and the id', async () => {
      vi.mocked(prismaService.$queryRaw)
        .mockResolvedValueOnce([{ isNull: false }])
        .mockResolvedValueOnce([]);
      vi.mocked(prismaService.novel.findMany).mockResolvedValue([]);
      const cursorId = '5b2c0f3e-0a53-4d3c-9d2c-9a3d1f7f4a10';

      await uut.findNovelsPage({
        page: { ...page, cursor: { id: cursorId }, skip: 1 },
        order,
      });

      expect(lastQuery().sql).toContain(
        '(n.name > (SELECT n.name FROM novels n WHERE n.id = $1::uuid) OR (n.name = (SELECT n.name FROM novels n WHERE n.id = $2::uuid) AND n.id > $3::uuid))',
      );
    });

    it('should refuse a cursor whose row no longer exists', async () => {
      vi.mocked(prismaService.$queryRaw).mockResolvedValueOnce([]);

      const result = uut.findNovelsPage({
        page: {
          ...page,
          cursor: { id: '5b2c0f3e-0a53-4d3c-9d2c-9a3d1f7f4a10' },
        },
        order,
      });

      await expect(result).rejects.toThrow('Invalid cursor');
    });

    it('should propagate the error when database fails', async () => {
      vi.mocked(prismaService.$queryRaw).mockRejectedValue(
        new Error('Database error'),
      );

      const result = uut.findNovelsPage({ page, order });

      await expect(result).rejects.toThrow('Database error');
    });
  });

  describe('estimateChapterCounts', () => {
    const novelId = '78981754-46c4-4521-9216-b9b27dafeab2';
    const otherNovelId = '248c9fee-cad0-43fc-9abb-c2ab8ff002ec';

    it('should read the planner estimate of each novel', async () => {
      vi.mocked(prismaService.$queryRaw)
        .mockResolvedValueOnce([
          { 'QUERY PLAN': [{ Plan: { 'Plan Rows': 12 } }] },
        ])
        .mockResolvedValueOnce([
          { 'QUERY PLAN': [{ Plan: { 'Plan Rows': 1 } }] },
        ]);

      const result = await uut.estimateChapterCounts([
        novelId,
        otherNovelId,
      ]);

      expect(result).toStrictEqual(
        new Map([
          [novelId, 12],
          [otherNovelId, 1],
        ]),
      );
    });

    it('should give 0 and log a warning for a novel whose plan cannot be read', async () => {
      vi.mocked(prismaService.$queryRaw).mockRejectedValue(
        new Error('boom'),
      );

      const result = await uut.estimateChapterCounts([novelId]);

      expect(result.get(novelId)).toBe(0);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(novelId),
      );
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
        description: 'A test novel description',
        state: NovelState.ONGOING,
        ownerId: '230104087265432001',
        writerId: '5b2c0f3e-0a53-4d3c-9d2c-9a3d1f7f4a10',
        coverUrl: 'https://example.com/cover.jpg',
        tags: ['Fantasy', 'Adventure'],
      });
      expect(prismaService.novel.findUnique).toHaveBeenCalledWith({
        where: { id: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec' },
        include: {
          tags: {
            select: {
              tag: {
                select: { name: true },
              },
            },
          },
          writer: { select: { userId: true } },
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
});

function getMockedData() {
  const novel = {
    id: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
    name: 'Test Novel',
    description: 'A test novel description',
    state: 'ONGOING',
    writerId: '5b2c0f3e-0a53-4d3c-9d2c-9a3d1f7f4a10',
    writer: { userId: '230104087265432001' },
    coverUrl: 'https://example.com/cover.jpg',
    tags: [
      { tag: { name: 'Fantasy' } },
      { tag: { name: 'Adventure' } },
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

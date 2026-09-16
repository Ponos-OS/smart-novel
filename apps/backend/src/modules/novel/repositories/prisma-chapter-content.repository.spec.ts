import { ChapterContent as PrismaChapterContent } from '@prisma/client';
import { createHash } from 'crypto';

import { PrismaService } from '../../prisma';
import { PrismaChapterContentRepository } from './prisma-chapter-content.repository';

describe(PrismaChapterContentRepository.name, () => {
  let uut: PrismaChapterContentRepository;
  let prismaService: PrismaService;

  beforeEach(() => {
    prismaService = {
      chapterContent: {
        findMany: vi.fn(),
      },
      chapter: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    } as any;

    uut = new PrismaChapterContentRepository(prismaService);
  });

  describe('findByIds', () => {
    it('should return a map of content records keyed by id', async () => {
      const records = [
        {
          id: '3f0288ed-4042-429f-a89a-37dbd9874efa',
          content: 'Hello',
          contentHash:
            '185f8db32271fe25f561a6fc938b2e264306ec304eda518007d1764826381969',
          createdAt: new Date(),
          updatedAt: new Date('2026-09-15T10:00:00.000Z'),
        },
        {
          id: 'fd3c3ffe-945e-4d41-9129-e3c85e8ade6d',
          content: 'World',
          contentHash:
            '78ae647dc5544d227130a0682a51e30bc7777fbb6d8a8f17007463a3ecd1d524',
          createdAt: new Date(),
          updatedAt: new Date('2026-09-15T11:00:00.000Z'),
        },
      ] as PrismaChapterContent[];
      vi.mocked(
        prismaService.chapterContent.findMany,
      ).mockResolvedValue(records);

      const result = await uut.findByIds([
        '3f0288ed-4042-429f-a89a-37dbd9874efa',
        'fd3c3ffe-945e-4d41-9129-e3c85e8ade6d',
      ]);

      expect(result.size).toBe(2);
      expect(
        result.get('3f0288ed-4042-429f-a89a-37dbd9874efa'),
      ).toStrictEqual({
        id: '3f0288ed-4042-429f-a89a-37dbd9874efa',
        content: 'Hello',
        contentHash:
          '185f8db32271fe25f561a6fc938b2e264306ec304eda518007d1764826381969',
        updatedAt: '2026-09-15T10:00:00.000Z',
      });
      expect(
        result.get('fd3c3ffe-945e-4d41-9129-e3c85e8ade6d'),
      ).toStrictEqual({
        id: 'fd3c3ffe-945e-4d41-9129-e3c85e8ade6d',
        content: 'World',
        contentHash:
          '78ae647dc5544d227130a0682a51e30bc7777fbb6d8a8f17007463a3ecd1d524',
        updatedAt: '2026-09-15T11:00:00.000Z',
      });
    });

    it('should return empty map when no records found', async () => {
      vi.mocked(
        prismaService.chapterContent.findMany,
      ).mockResolvedValue([]);

      const result = await uut.findByIds(['non-existent-uuid']);

      expect(result.size).toBe(0);
    });
  });

  describe('findByChapterId', () => {
    it('should return content for a chapter', async () => {
      vi.mocked(prismaService.chapter.findUnique).mockResolvedValue({
        content: {
          id: 'eb82843d-d041-4dd2-94db-aadad59df0a6',
          content: '# Chapter text',
          contentHash:
            'b5a8193c78d9bc46c31904d8cf75c99d06ff824830a408e1f451bc3ae3dc1a37',
          updatedAt: new Date('2026-09-15T10:00:00.000Z'),
        },
      } as any);

      const result = await uut.findByChapterId(
        '0ba68b7c-ca4e-4829-84f2-253c45c746dc',
      );

      expect(result).toEqual({
        id: 'eb82843d-d041-4dd2-94db-aadad59df0a6',
        content: '# Chapter text',
        contentHash:
          'b5a8193c78d9bc46c31904d8cf75c99d06ff824830a408e1f451bc3ae3dc1a37',
        updatedAt: '2026-09-15T10:00:00.000Z',
      });
      expect(prismaService.chapter.findUnique).toHaveBeenCalledWith({
        where: { id: '0ba68b7c-ca4e-4829-84f2-253c45c746dc' },
        select: { content: true },
      });
    });

    it.each<any>([{ content: null }, null, undefined])(
      'should throw an error when chapter has no content',
      async (mockValue) => {
        vi.mocked(prismaService.chapter.findUnique).mockResolvedValue(
          mockValue,
        );

        const result = uut.findByChapterId(
          '0ba68b7c-ca4e-4829-84f2-253c45c746dc',
        );

        await expect(result).rejects.toThrow(
          'Chapter content not found',
        );
      },
    );
  });

  describe('upsertByChapterId', () => {
    it('should upsert content and return the result', async () => {
      const contentText = '# Chapter 1\n\nSome content';
      const expectedHash = createHash('sha256')
        .update(contentText)
        .digest('hex');
      vi.mocked(prismaService.chapter.update).mockResolvedValue({
        content: {
          id: '0be4fe14-8fa6-48b5-b894-3b4fdca60943',
          content: contentText,
          contentHash: expectedHash,
          updatedAt: new Date('2026-09-15T10:00:00.000Z'),
        },
      } as any);

      const result = await uut.upsertByChapterId(
        '0ba68b7c-ca4e-4829-84f2-253c45c746dc',
        contentText,
      );

      expect(result).toEqual({
        id: '0be4fe14-8fa6-48b5-b894-3b4fdca60943',
        content: contentText,
        contentHash: expectedHash,
        updatedAt: '2026-09-15T10:00:00.000Z',
      });
      expect(prismaService.chapter.update).toHaveBeenCalledWith({
        where: { id: '0ba68b7c-ca4e-4829-84f2-253c45c746dc' },
        data: {
          content: {
            upsert: {
              create: {
                content: contentText,
                contentHash: expectedHash,
              },
              update: {
                content: contentText,
                contentHash: expectedHash,
              },
            },
          },
        },
        include: { content: true },
      });
    });

    it('should use provided transaction client', async () => {
      const txClient = {
        chapter: {
          update: vi.fn().mockResolvedValue({
            content: {
              id: 'b6c8df91-c655-4e76-bf16-ecfacb6e1aff',
              content: 'tx content',
              contentHash:
                'd5bf5cb7cea90a4a42394a89ca5c06f9bbb27ae7bd87d1cb35cd1b65f73317c7',
              updatedAt: new Date('2026-09-15T10:00:00.000Z'),
            },
          }),
        },
      } as any;

      const result = await uut.upsertByChapterId(
        '0ba68b7c-ca4e-4829-84f2-253c45c746dc',
        'tx content',
        txClient,
      );

      expect(result.id).toBe('b6c8df91-c655-4e76-bf16-ecfacb6e1aff');
      expect(txClient.chapter.update).toHaveBeenCalled();
      expect(prismaService.chapter.update).not.toHaveBeenCalled();
    });
  });
});

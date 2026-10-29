import { NovelState } from '@prisma/client';
import { Role } from '@smart-novel/shared';

import { type IAuthUser } from '../../auth';
import { NovelAction } from '../enums';
import { NovelCoverService, NovelService } from '../services';
import { Novel } from '../types';
import { NovelResolver } from './novel.resolver';

describe(NovelResolver.name, () => {
  let uut: NovelResolver;
  let novelService: NovelService;
  let novelCoverService: NovelCoverService;

  beforeEach(() => {
    novelService = {
      getChapter: vi.fn(),
      getFirstChapter: vi.fn(),
      getLastChapter: vi.fn(),
      getChaptersConnection: vi.fn(),
      createNovel: vi.fn(),
      updateNovel: vi.fn(),
      deleteNovel: vi.fn(),
    } as any;
    novelCoverService = {
      createUploadUrl: vi.fn(),
      setCover: vi.fn(),
    } as any;
    uut = new NovelResolver(novelService, novelCoverService);
  });

  describe('createNovel', () => {
    it('should create the novel owned by the caller', async () => {
      const novel = getNovel({ ownerId: '260311094522198751' });
      const input = {
        name: 'The Journey Begins',
        author: 'Jane Doe',
        description: 'A young hero leaves home.',
      };
      vi.mocked(novelService.createNovel).mockResolvedValue(novel);

      const result = await uut.createNovel(input, {
        sub: '260311094522198751',
        roles: [Role.writer],
      } as IAuthUser);

      expect(
        novelService.createNovel,
      ).toHaveBeenCalledExactlyOnceWith('260311094522198751', input);
      expect(result).toBe(novel);
    });
  });

  describe('updateNovel', () => {
    it('should delegate the id and input to the service', async () => {
      const novel = getNovel({ ownerId: '260311094522198751' });
      vi.mocked(novelService.updateNovel).mockResolvedValue(novel);

      const result = await uut.updateNovel(novel.id, {
        state: NovelState.FINISHED,
      });

      expect(
        novelService.updateNovel,
      ).toHaveBeenCalledExactlyOnceWith(novel.id, {
        state: NovelState.FINISHED,
      });
      expect(result).toBe(novel);
    });
  });

  describe('createNovelCoverUploadUrl', () => {
    it('should delegate the novel id, content type and length to the cover service', async () => {
      const novelId = '78981754-46c4-4521-9216-b9b27dafeab2';
      const uploadUrl = {
        uploadUrl:
          'http://s3.localhost:8080/smart-novel/covers/x.png?X-Amz-Signature=abc',
        objectKey: `covers/${novelId}/5c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f.png`,
      };
      vi.mocked(novelCoverService.createUploadUrl).mockResolvedValue(
        uploadUrl,
      );

      const result = await uut.createNovelCoverUploadUrl(
        novelId,
        'image/png',
        204800,
      );

      expect(
        novelCoverService.createUploadUrl,
      ).toHaveBeenCalledExactlyOnceWith(novelId, 'image/png', 204800);
      expect(result).toBe(uploadUrl);
    });
  });

  describe('setNovelCover', () => {
    it('should delegate the novel id and object key to the cover service', async () => {
      const novel = getNovel({ ownerId: '260311094522198751' });
      const objectKey = `covers/${novel.id}/5c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f.png`;
      vi.mocked(novelCoverService.setCover).mockResolvedValue(novel);

      const result = await uut.setNovelCover(novel.id, objectKey);

      expect(
        novelCoverService.setCover,
      ).toHaveBeenCalledExactlyOnceWith(novel.id, objectKey);
      expect(result).toBe(novel);
    });
  });

  describe('deleteNovel', () => {
    it('should delegate the id to the service', async () => {
      const novelId = '78981754-46c4-4521-9216-b9b27dafeab2';
      vi.mocked(novelService.deleteNovel).mockResolvedValue({
        id: novelId,
      });

      const result = await uut.deleteNovel(novelId);

      expect(
        novelService.deleteNovel,
      ).toHaveBeenCalledExactlyOnceWith(novelId);
      expect(result).toEqual({ id: novelId });
    });
  });

  describe('lastChapterPublishedAt', () => {
    it('should return the last chapter published date', async () => {
      const novel = getNovel({ ownerId: '260311094522198751' });
      const updatedAt = new Date(
        '2026-02-20T10:20:30.000Z',
      ).toISOString();
      vi.mocked(novelService.getLastChapter).mockResolvedValue({
        content: '# Chapter 2',
        createdAt: new Date('2026-02-19T00:00:00.000Z').toISOString(),
        id: 'db1be1a7-e3bf-46d3-8899-980219f95d07',
        novelId: '78981754-46c4-4521-9216-b9b27dafeab2',
        updatedAt,
      } as any);

      const result = await uut.lastChapterPublishedAt(novel);

      expect(result).toBe('2026-02-20T10:20:30.000Z');
      expect(novelService.getLastChapter).toHaveBeenCalledWith(
        '78981754-46c4-4521-9216-b9b27dafeab2',
      );
    });

    it('should return null when there are no chapters', async () => {
      const novel = getNovel({ ownerId: '260311094522198751' });
      vi.mocked(novelService.getLastChapter).mockResolvedValue(null);

      const result = await uut.lastChapterPublishedAt(novel);

      expect(result).toBeNull();
      expect(novelService.getLastChapter).toHaveBeenCalledWith(
        '78981754-46c4-4521-9216-b9b27dafeab2',
      );
    });
  });

  describe('lastPublishedChapter', () => {
    it('should return the last published chapter', async () => {
      const novel = getNovel({ ownerId: '260311094522198751' });
      const chapter = {
        content: '# Chapter 2',
        chapterNumber: 2,
        createdAt: new Date('2026-02-19T00:00:00.000Z').toISOString(),
        id: 'db1be1a7-e3bf-46d3-8899-980219f95d07',
        novelId: '78981754-46c4-4521-9216-b9b27dafeab2',
        contentId: '99383df4-b8e9-4791-be96-034b31525711',
        title: 'Chapter Two',
        updatedAt: new Date('2026-02-20T10:20:30.000Z').toISOString(),
      };
      vi.mocked(novelService.getLastChapter).mockResolvedValue(
        chapter,
      );

      const result = await uut.lastPublishedChapter(novel);

      expect(result).toEqual(chapter);
      expect(novelService.getLastChapter).toHaveBeenCalledWith(
        '78981754-46c4-4521-9216-b9b27dafeab2',
      );
    });

    it('should return null when there are no chapters', async () => {
      const novel = getNovel({ ownerId: '260311094522198751' });
      vi.mocked(novelService.getLastChapter).mockResolvedValue(null);

      const result = await uut.lastPublishedChapter(novel);

      expect(result).toBeNull();
      expect(novelService.getLastChapter).toHaveBeenCalledWith(
        '78981754-46c4-4521-9216-b9b27dafeab2',
      );
    });
  });

  describe('firstChapter', () => {
    it('should return the first chapter', async () => {
      const novel = getNovel({ ownerId: '260311094522198751' });
      const chapter = {
        content: '# Chapter 1',
        chapterNumber: 1,
        createdAt: new Date('2026-02-18T00:00:00.000Z').toISOString(),
        id: '54f74d6a-a80b-4b20-8a19-339b99da5362',
        novelId: '78981754-46c4-4521-9216-b9b27dafeab2',
        title: 'Chapter One',
        contentId: '9d3139e7-009b-42ad-b488-cfe3cc19f1d2',
        updatedAt: new Date('2026-02-18T00:00:00.000Z').toISOString(),
      };
      vi.mocked(novelService.getFirstChapter).mockResolvedValue(
        chapter,
      );

      const result = await uut.firstChapter(novel);

      expect(result).toEqual(chapter);
      expect(novelService.getFirstChapter).toHaveBeenCalledWith(
        '78981754-46c4-4521-9216-b9b27dafeab2',
      );
    });

    it('should return null when there are no chapters', async () => {
      const novel = getNovel({ ownerId: '269311094522198752' });
      vi.mocked(novelService.getFirstChapter).mockResolvedValue(null);

      const result = await uut.firstChapter(novel);

      expect(result).toBeNull();
      expect(novelService.getFirstChapter).toHaveBeenCalledWith(
        '78981754-46c4-4521-9216-b9b27dafeab2',
      );
    });
  });

  describe('allowedActions', () => {
    it.each([Role.admin, Role.writer])(
      'should return MANAGE_TTS and EDIT_CONTENT for a $role user',
      (role) => {
        const user: IAuthUser = {
          sub: '240311094522198754',
          name: 'Owner',
          preferredUsername: 'owner',
          email: 'owner@test.com',
          emailVerified: true,
          roles: [role],
          metadata: {},
        };
        const novel = getNovel({ ownerId: '240311094522198754' });

        const result = uut.allowedActions(novel, user);

        expect(result).toEqual([
          NovelAction.MANAGE_TTS,
          NovelAction.EDIT_CONTENT,
        ]);
      },
    );

    it.each<{ roles: string[] }>([
      { roles: [] },
      { roles: ['reader'] },
    ])(
      'should return an empty array when the user is neither the owner nor an admin ($roles)',
      ({ roles }) => {
        const user: IAuthUser = {
          sub: '300311094522198754',
          name: 'Reader',
          preferredUsername: 'reader',
          email: 'reader@test.com',
          emailVerified: true,
          roles,
          metadata: {},
        };
        const novel = getNovel({ ownerId: '230104087265432001' });

        const result = uut.allowedActions(novel, user);

        expect(result).toEqual([]);
      },
    );
  });
});

function getNovel({ ownerId }: { ownerId: string }): Novel {
  return {
    id: '78981754-46c4-4521-9216-b9b27dafeab2',
    name: 'Test Novel',
    author: 'Author',
    category: ['fantasy'],
    state: NovelState.ONGOING,
    description: 'A test novel',
    ownerId,
    licenseId: '3f7b0c1e-6d52-4b8a-9a41-5c2e8d7f1a06',
  };
}

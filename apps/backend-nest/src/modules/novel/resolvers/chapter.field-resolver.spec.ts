import { BadRequestException } from '@nestjs/common';

import { IAuthUser } from '../../auth';
import {
  ChapterContentDataLoader,
  ChapterNavigationDataLoader,
  ChapterViewerStateDataLoader,
} from '../dataloaders';
import { IChapterContent } from '../interfaces';
import { Chapter } from '../types';
import { ChapterFieldResolver } from './chapter.field-resolver';

describe(ChapterFieldResolver.name, () => {
  let uut: ChapterFieldResolver;
  let chapterContentDataLoader: ChapterContentDataLoader;
  let chapterNavigationDataLoader: ChapterNavigationDataLoader;
  let chapterViewerStateDataLoader: ChapterViewerStateDataLoader;

  beforeEach(() => {
    chapterContentDataLoader = {
      load: vi.fn(),
    } as any;
    chapterNavigationDataLoader = {
      load: vi.fn(),
    } as any;
    chapterViewerStateDataLoader = {
      load: vi.fn(),
      setUserId: vi.fn(),
    } as any;

    uut = new ChapterFieldResolver(
      chapterContentDataLoader,
      chapterNavigationDataLoader,
      chapterViewerStateDataLoader,
    );
  });

  describe('content', () => {
    it('should return the chapter content', async () => {
      const chapter = {
        contentId: '456c3e4a-b353-4938-aa5b-900b685b134f',
      } as Chapter;
      const chapterContent: IChapterContent = {
        id: '456c3e4a-b353-4938-aa5b-900b685b134f',
        content: '# Chapter 1\n\nSome content',
        contentHash: 'hash-1',
        updatedAt: '2026-09-15T10:00:00.000Z',
      };
      vi.mocked(chapterContentDataLoader.load).mockResolvedValue(
        chapterContent,
      );

      const result = await uut.content(chapter);

      expect(result).toBe('# Chapter 1\n\nSome content');
      expect(chapterContentDataLoader.load).toHaveBeenCalledWith(
        '456c3e4a-b353-4938-aa5b-900b685b134f',
      );
    });

    it('should throw BadRequestException when chapter content is not found', async () => {
      const chapter = { contentId: 'non-existent-uuid' } as Chapter;
      vi.mocked(chapterContentDataLoader.load).mockResolvedValue(
        null,
      );

      await expect(uut.content(chapter)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('contentUpdatedAt', () => {
    it("should return the chapter content's updatedAt", async () => {
      const chapter = {
        contentId: '456c3e4a-b353-4938-aa5b-900b685b134f',
      } as Chapter;
      const chapterContent: IChapterContent = {
        id: '456c3e4a-b353-4938-aa5b-900b685b134f',
        content: '# Chapter 1\n\nSome content',
        contentHash: 'hash-1',
        updatedAt: '2026-09-15T10:00:00.000Z',
      };
      vi.mocked(chapterContentDataLoader.load).mockResolvedValue(
        chapterContent,
      );

      const result = await uut.contentUpdatedAt(chapter);

      expect(result).toBe('2026-09-15T10:00:00.000Z');
      expect(chapterContentDataLoader.load).toHaveBeenCalledWith(
        '456c3e4a-b353-4938-aa5b-900b685b134f',
      );
    });

    it('should throw BadRequestException when chapter content is not found', async () => {
      const chapter = { contentId: 'non-existent-uuid' } as Chapter;
      vi.mocked(chapterContentDataLoader.load).mockResolvedValue(
        null,
      );

      await expect(uut.contentUpdatedAt(chapter)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('next', () => {
    it('should load the next chapter via the navigation dataloader', async () => {
      const chapter = {
        novelId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        chapterNumber: 1,
      } as Chapter;

      await uut.next(chapter);

      expect(chapterNavigationDataLoader.load).toHaveBeenCalledWith({
        novelId: chapter.novelId,
        chapterNumber: chapter.chapterNumber,
        adjacency: 'next',
      });
    });
  });

  describe('previous', () => {
    it('should load the previous chapter via the navigation dataloader', async () => {
      const chapter = {
        novelId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        chapterNumber: 3,
      } as Chapter;

      await uut.previous(chapter);

      expect(chapterNavigationDataLoader.load).toHaveBeenCalledWith({
        novelId: chapter.novelId,
        chapterNumber: chapter.chapterNumber,
        adjacency: 'previous',
      });
    });
  });

  describe('viewerState', () => {
    it('should return false of isRead when user is not logged in', async () => {
      const chapter = {} as Chapter;

      const res = await uut.viewerState(chapter);

      expect(res).toStrictEqual({
        isRead: false,
        readAt: undefined,
      });
    });

    it('should load viewer state from the dataloader', async () => {
      const chapter = {
        id: 'abbc9ff8-fbc9-43d2-a13b-e9493f9d127b',
      } as Chapter;
      const user = { sub: '268103642598401' } as IAuthUser;

      await uut.viewerState(chapter, user);

      expect(
        chapterViewerStateDataLoader.setUserId,
      ).toHaveBeenCalledWith(user.sub);
      expect(chapterViewerStateDataLoader.load).toHaveBeenCalledWith(
        chapter.id,
      );
    });
  });
});

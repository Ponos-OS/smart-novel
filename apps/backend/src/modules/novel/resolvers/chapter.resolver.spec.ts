import { ForbiddenException } from '@nestjs/common';

import type { ChapterPolicy } from '../../auth';
import type {
  ChapterNarrationService,
  ChapterService,
} from '../services';

import { ChapterResolver } from './chapter.resolver';

describe(ChapterResolver.name, () => {
  let uut: ChapterResolver;
  let chapterService: ChapterService;
  let chapterNarrationService: ChapterNarrationService;
  let chapterPolicy: ChapterPolicy;

  beforeEach(() => {
    chapterService = {
      createChapter: vi.fn(),
      updateContent: vi.fn(),
      updateChapter: vi.fn(),
    } as any;
    chapterNarrationService = {
      regenerateAudio: vi.fn(),
    } as any;
    chapterPolicy = {
      assertCanCreateInNovel: vi.fn().mockResolvedValue(undefined),
    } as any;

    uut = new ChapterResolver(
      chapterService,
      chapterNarrationService,
      chapterPolicy,
    );
  });

  describe('createChapter', () => {
    const user = {
      sub: '234980127461293847',
      name: 'Test Writer',
      preferredUsername: 'testwriter',
      email: 'writer@example.com',
      emailVerified: true,
      roles: ['writer'],
      metadata: {},
    } as any;

    it('should check novel ownership, then delegate to the service with the novel id, input, and caller authorization header', async () => {
      const novelId = '4754496a-ccb4-4a6b-805d-809a6cea97c8';
      const input = {
        title: 'Chapter 1: The Beginning',
        content: '# Chapter 1\n\nIt was a dark and stormy night.',
      };
      const authorization = 'Bearer some-jwt';
      const createdChapter = {
        id: '4bbc4da9-107c-4872-9809-78f6191a092d',
        novelId,
        contentId: 'fdba9d1b-32db-4b18-85c4-a5f2e680dcec',
        title: input.title,
        chapterNumber: 1,
      };
      vi.mocked(chapterService.createChapter).mockResolvedValue(
        createdChapter as any,
      );

      const result = await uut.createChapter(
        novelId,
        input,
        user,
        authorization,
      );

      expect(
        chapterPolicy.assertCanCreateInNovel,
      ).toHaveBeenCalledExactlyOnceWith(user, novelId);
      expect(
        chapterService.createChapter,
      ).toHaveBeenCalledExactlyOnceWith(
        { novelId, title: input.title, content: input.content },
        authorization,
      );
      expect(result).toBe(createdChapter);
    });

    it('should throw ForbiddenException and not call the service when the user does not own the novel', async () => {
      const novelId = '4754496a-ccb4-4a6b-805d-809a6cea97c8';
      const input = { title: 'Chapter 1', content: 'Some content.' };
      vi.mocked(
        chapterPolicy.assertCanCreateInNovel,
      ).mockRejectedValue(new ForbiddenException('denied'));

      const result = uut.createChapter(
        novelId,
        input,
        user,
        'Bearer some-jwt',
      );

      await expect(result).rejects.toThrow(ForbiddenException);
      expect(chapterService.createChapter).not.toHaveBeenCalled();
    });
  });

  describe('updateContent', () => {
    it('should persist the content and trigger audio regeneration exactly once with the same chapter/content, returning the persisted chapter', async () => {
      const chapterId = '4bbc4da9-107c-4872-9809-78f6191a092d';
      const content = '# Chapter 1\n\nHooray';
      const expectedContentUpdatedAt = '2026-09-15T10:00:00.000Z';
      const authorization = 'Bearer some-jwt';
      const persistedChapter = {
        id: chapterId,
        novelId: '4754496a-ccb4-4a6b-805d-809a6cea97c8',
        contentId: 'fdba9d1b-32db-4b18-85c4-a5f2e680dcec',
        title: 'Chapter 1',
      };
      vi.mocked(chapterService.updateContent).mockResolvedValue({
        chapter: persistedChapter as any,
        contentChanged: true,
      });

      const result = await uut.updateContent(
        chapterId,
        content,
        expectedContentUpdatedAt,
        authorization,
      );

      expect(chapterService.updateContent).toHaveBeenCalledWith(
        chapterId,
        content,
        expectedContentUpdatedAt,
      );
      expect(
        chapterNarrationService.regenerateAudio,
      ).toHaveBeenCalledExactlyOnceWith(
        chapterId,
        content,
        authorization,
      );
      expect(result).toBe(persistedChapter);
    });

    it('should not trigger audio regeneration when the saved content is unchanged (no-op save)', async () => {
      const chapterId = '4bbc4da9-107c-4872-9809-78f6191a092d';
      const content = '# Chapter 1\n\nHooray';
      const expectedContentUpdatedAt = '2026-09-15T10:00:00.000Z';
      const authorization = 'Bearer some-jwt';
      const persistedChapter = {
        id: chapterId,
        novelId: '4754496a-ccb4-4a6b-805d-809a6cea97c8',
        contentId: 'fdba9d1b-32db-4b18-85c4-a5f2e680dcec',
        title: 'Chapter 1',
      };
      vi.mocked(chapterService.updateContent).mockResolvedValue({
        chapter: persistedChapter as any,
        contentChanged: false,
      });

      const result = await uut.updateContent(
        chapterId,
        content,
        expectedContentUpdatedAt,
        authorization,
      );

      expect(
        chapterNarrationService.regenerateAudio,
      ).not.toHaveBeenCalled();
      expect(result).toBe(persistedChapter);
    });

    it('should not trigger audio regeneration when the service rejects a stale content version', async () => {
      const chapterId = '4bbc4da9-107c-4872-9809-78f6191a092d';
      const content = '# Chapter 1\n\nHooray';
      const expectedContentUpdatedAt = '2026-09-15T10:00:00.000Z';
      const authorization = 'Bearer some-jwt';
      const conflictError = new Error('conflict');
      vi.mocked(chapterService.updateContent).mockRejectedValue(
        conflictError,
      );

      const result = uut.updateContent(
        chapterId,
        content,
        expectedContentUpdatedAt,
        authorization,
      );

      await expect(result).rejects.toThrow(conflictError);
      expect(
        chapterNarrationService.regenerateAudio,
      ).not.toHaveBeenCalled();
    });
  });

  describe('updateChapter', () => {
    it('should update chapter metadata and not trigger audio regeneration', async () => {
      const chapterId = '4bbc4da9-107c-4872-9809-78f6191a092d';
      const input = { title: 'A New Dawn' };
      const expectedUpdatedAt = '2026-09-15T10:00:00.000Z';
      const persistedChapter = {
        id: chapterId,
        novelId: '4754496a-ccb4-4a6b-805d-809a6cea97c8',
        contentId: 'fdba9d1b-32db-4b18-85c4-a5f2e680dcec',
        title: 'A New Dawn',
      };
      vi.mocked(chapterService.updateChapter).mockResolvedValue(
        persistedChapter as any,
      );

      const result = await uut.updateChapter(
        chapterId,
        input,
        expectedUpdatedAt,
      );

      expect(
        chapterService.updateChapter,
      ).toHaveBeenCalledExactlyOnceWith(
        chapterId,
        input,
        expectedUpdatedAt,
      );
      expect(
        chapterNarrationService.regenerateAudio,
      ).not.toHaveBeenCalled();
      expect(result).toBe(persistedChapter);
    });
  });
});

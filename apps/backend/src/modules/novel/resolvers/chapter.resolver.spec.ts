import type {
  ChapterNarrationService,
  ChapterService,
} from '../services';

import { ChapterResolver } from './chapter.resolver';

describe(ChapterResolver.name, () => {
  let uut: ChapterResolver;
  let chapterService: ChapterService;
  let chapterNarrationService: ChapterNarrationService;

  beforeEach(() => {
    chapterService = {
      updateContent: vi.fn(),
      updateChapter: vi.fn(),
    } as any;
    chapterNarrationService = {
      regenerateAudio: vi.fn(),
    } as any;

    uut = new ChapterResolver(
      chapterService,
      chapterNarrationService,
    );
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

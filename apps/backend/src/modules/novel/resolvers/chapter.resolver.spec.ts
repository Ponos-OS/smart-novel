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
      const persistedChapter = {
        id: chapterId,
        novelId: '4754496a-ccb4-4a6b-805d-809a6cea97c8',
        contentId: 'fdba9d1b-32db-4b18-85c4-a5f2e680dcec',
        title: 'Chapter 1',
      };
      vi.mocked(chapterService.updateContent).mockResolvedValue(
        persistedChapter as any,
      );

      const result = await uut.updateContent(chapterId, content);

      expect(chapterService.updateContent).toHaveBeenCalledWith(
        chapterId,
        content,
      );
      expect(
        chapterNarrationService.regenerateAudio,
      ).toHaveBeenCalledExactlyOnceWith(chapterId, content);
      expect(result).toBe(persistedChapter);
    });
  });
});

import type { ChapterNarrationService } from '../services';

import { ChapterNarrationResolver } from './chapter-narration.resolver';

describe(ChapterNarrationResolver.name, () => {
  let narrationService: ChapterNarrationService;
  let uut: ChapterNarrationResolver;

  beforeEach(() => {
    narrationService = {
      generateChapterAudio: vi.fn(),
      subscribeToChapterNarration: vi.fn(),
    } as any;

    uut = new ChapterNarrationResolver(narrationService);
  });

  describe('generateChapterAudio', () => {
    it('should delegate to the service with only the chapter id — no forceRegenerate argument', async () => {
      // Arrange
      const chapterId = '4bbc4da9-107c-4872-9809-78f6191a092d';
      const response = { status: 'PROCESSING' };
      vi.mocked(
        narrationService.generateChapterAudio,
      ).mockResolvedValue(response as any);

      // Act
      const result = await uut.generateChapterAudio(chapterId);

      // Assert
      expect(
        narrationService.generateChapterAudio,
      ).toHaveBeenCalledExactlyOnceWith(chapterId);
      // Compile-time signature check: if `forceRegenerate` were re-added, this
      // method would take 2 parameters again and this assertion would fail.
      expect(uut.generateChapterAudio.length).toBe(1);
      expect(result).toBe(response);
    });
  });
});

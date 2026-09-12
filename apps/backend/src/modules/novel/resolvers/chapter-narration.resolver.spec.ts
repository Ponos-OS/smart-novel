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
    it('should delegate to the service with the chapter id and the caller authorization header', async () => {
      // Arrange
      const chapterId = '4bbc4da9-107c-4872-9809-78f6191a092d';
      const authorization = 'Bearer some-jwt';
      const response = { status: 'PROCESSING' };
      vi.mocked(
        narrationService.generateChapterAudio,
      ).mockResolvedValue(response as any);

      // Act
      const result = await uut.generateChapterAudio(
        chapterId,
        authorization,
      );

      // Assert
      expect(
        narrationService.generateChapterAudio,
      ).toHaveBeenCalledExactlyOnceWith(chapterId, authorization);
      expect(result).toBe(response);
    });
  });
});

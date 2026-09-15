import { NotFoundException } from '@nestjs/common';

import type {
  IChapterContentRepository,
  IChapterRepository,
} from '../interfaces';

import { ChapterService } from './chapter.service';

describe(ChapterService.name, () => {
  let uut: ChapterService;
  let chapterRepository: IChapterRepository;
  let chapterContentRepository: IChapterContentRepository;

  beforeEach(() => {
    chapterRepository = {
      findById: vi.fn(),
      getChapter: vi.fn(),
      updateChapterMetadata: vi.fn(),
      updateNarrationStatus: vi.fn(),
      updateChapterNarrationUrl: vi.fn(),
      updateChapterNarrationComplete: vi.fn(),
    };

    chapterContentRepository = {
      findByIds: vi.fn(),
      findByChapterId: vi.fn(),
      upsertByChapterId: vi.fn(),
    };

    uut = new ChapterService(
      chapterRepository,
      chapterContentRepository,
    );
  });

  describe('updateChapter', () => {
    it("should update only the chapter's metadata via the repository", async () => {
      vi.mocked(chapterRepository.findById).mockResolvedValue({
        id: '4bbc4da9-107c-4872-9809-78f6191a092d',
        novelId: '4754496a-ccb4-4a6b-805d-809a6cea97c8',
        contentId: 'fdba9d1b-32db-4b18-85c4-a5f2e680dcec',
        title: 'Chapter 1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      const updatedChapter = {
        id: '4bbc4da9-107c-4872-9809-78f6191a092d',
        novelId: '4754496a-ccb4-4a6b-805d-809a6cea97c8',
        contentId: 'fdba9d1b-32db-4b18-85c4-a5f2e680dcec',
        title: 'A New Dawn',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      vi.mocked(
        chapterRepository.updateChapterMetadata,
      ).mockResolvedValue(updatedChapter);

      const res = await uut.updateChapter(
        '4bbc4da9-107c-4872-9809-78f6191a092d',
        { title: 'A New Dawn' },
      );

      expect(
        chapterRepository.updateChapterMetadata,
      ).toHaveBeenCalledExactlyOnceWith(
        '4bbc4da9-107c-4872-9809-78f6191a092d',
        { title: 'A New Dawn' },
      );
      expect(res).toBe(updatedChapter);
    });

    it('should raise an exception if chapter does NOT exist', async () => {
      vi.mocked(chapterRepository.findById).mockResolvedValue(null);

      const res = uut.updateChapter(
        '761ba2ab-8d2f-46b0-8cf2-11f072be3bba',
        { title: 'A New Dawn' },
      );

      await expect(res).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateContent', () => {
    it("should update the chapter's content via content repository", async () => {
      vi.mocked(chapterRepository.findById).mockResolvedValue({
        id: '4bbc4da9-107c-4872-9809-78f6191a092d',
        novelId: '4754496a-ccb4-4a6b-805d-809a6cea97c8',
        contentId: 'fdba9d1b-32db-4b18-85c4-a5f2e680dcec',
        title: 'Chapter 1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(
        chapterContentRepository.upsertByChapterId,
      ).mockResolvedValue({
        id: 'fdba9d1b-32db-4b18-85c4-a5f2e680dcec',
        content: '# Chapter 1\n\nHooray',
        contentHash: 'hash',
      });

      const res = await uut.updateContent(
        '4bbc4da9-107c-4872-9809-78f6191a092d',
        '# Chapter 1\n\nHooray',
      );

      expect(
        chapterContentRepository.upsertByChapterId,
      ).toHaveBeenCalledWith(
        '4bbc4da9-107c-4872-9809-78f6191a092d',
        '# Chapter 1\n\nHooray',
      );
      expect(res.contentId).toBe(
        'fdba9d1b-32db-4b18-85c4-a5f2e680dcec',
      );
    });

    it('should raise an exception if chapter does NOT exist', async () => {
      vi.mocked(chapterRepository.findById).mockResolvedValue(null);

      const res = uut.updateContent(
        '761ba2ab-8d2f-46b0-8cf2-11f072be3bba',
        '# Chapter 1\n\nHello',
      );

      await expect(res).rejects.toThrow(NotFoundException);
    });
  });
});

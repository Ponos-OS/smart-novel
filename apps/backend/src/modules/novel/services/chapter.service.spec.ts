import { ConflictException, NotFoundException } from '@nestjs/common';

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
    } as any;

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
    it("should update only the chapter's metadata via the repository when the expected version matches", async () => {
      vi.mocked(chapterRepository.findById).mockResolvedValue({
        id: '4bbc4da9-107c-4872-9809-78f6191a092d',
        novelId: '4754496a-ccb4-4a6b-805d-809a6cea97c8',
        contentId: 'fdba9d1b-32db-4b18-85c4-a5f2e680dcec',
        title: 'Chapter 1',
        createdAt: new Date().toISOString(),
        updatedAt: '2026-09-15T10:00:00.000Z',
        chapterNumber: 1,
      });
      const updatedChapter = {
        id: '4bbc4da9-107c-4872-9809-78f6191a092d',
        novelId: '4754496a-ccb4-4a6b-805d-809a6cea97c8',
        contentId: 'fdba9d1b-32db-4b18-85c4-a5f2e680dcec',
        title: 'A New Dawn',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        chapterNumber: 1,
      };
      vi.mocked(
        chapterRepository.updateChapterMetadata,
      ).mockResolvedValue(updatedChapter);

      const res = await uut.updateChapter(
        '4bbc4da9-107c-4872-9809-78f6191a092d',
        { title: 'A New Dawn' },
        '2026-09-15T10:00:00.000Z',
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
        '2026-09-15T10:00:00.000Z',
      );

      await expect(res).rejects.toThrow(NotFoundException);
    });

    it("should raise ConflictException and NOT write when the expected version doesn't match the chapter's current version", async () => {
      vi.mocked(chapterRepository.findById).mockResolvedValue({
        id: '4bbc4da9-107c-4872-9809-78f6191a092d',
        novelId: '4754496a-ccb4-4a6b-805d-809a6cea97c8',
        contentId: 'fdba9d1b-32db-4b18-85c4-a5f2e680dcec',
        title: 'Chapter 1',
        createdAt: new Date().toISOString(),
        updatedAt: '2026-09-15T10:05:00.000Z',
        chapterNumber: 1,
      });

      const res = uut.updateChapter(
        '4bbc4da9-107c-4872-9809-78f6191a092d',
        { title: 'A New Dawn' },
        '2026-09-15T10:00:00.000Z',
      );

      await expect(res).rejects.toThrow(ConflictException);
      expect(
        chapterRepository.updateChapterMetadata,
      ).not.toHaveBeenCalled();
    });

    it('should succeed when saving a title after an unrelated content-only change to the same chapter (independent version tokens)', async () => {
      vi.mocked(chapterRepository.findById).mockResolvedValue({
        id: '4bbc4da9-107c-4872-9809-78f6191a092d',
        novelId: '4754496a-ccb4-4a6b-805d-809a6cea97c8',
        contentId: 'fdba9d1b-32db-4b18-85c4-a5f2e680dcec',
        title: 'Chapter 1',
        createdAt: new Date().toISOString(),
        updatedAt: '2026-09-15T10:00:00.000Z',
        chapterNumber: 1,
      });
      const updatedChapter = {
        id: '4bbc4da9-107c-4872-9809-78f6191a092d',
        title: 'A New Dawn',
      };
      vi.mocked(
        chapterRepository.updateChapterMetadata,
      ).mockResolvedValue(updatedChapter as any);

      const res = await uut.updateChapter(
        '4bbc4da9-107c-4872-9809-78f6191a092d',
        { title: 'A New Dawn' },
        '2026-09-15T10:00:00.000Z',
      );

      expect(res).toBe(updatedChapter);
    });
  });

  describe('updateContent', () => {
    it("should update the chapter's content via content repository when the expected version matches", async () => {
      vi.mocked(chapterRepository.findById).mockResolvedValue({
        id: '4bbc4da9-107c-4872-9809-78f6191a092d',
        novelId: '4754496a-ccb4-4a6b-805d-809a6cea97c8',
        contentId: 'fdba9d1b-32db-4b18-85c4-a5f2e680dcec',
        title: 'Chapter 1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(
        chapterContentRepository.findByChapterId,
      ).mockResolvedValue({
        id: 'fdba9d1b-32db-4b18-85c4-a5f2e680dcec',
        content: '# Chapter 1',
        contentHash: 'hash',
        updatedAt: '2026-09-15T10:00:00.000Z',
      });
      vi.mocked(
        chapterContentRepository.upsertByChapterId,
      ).mockResolvedValue({
        id: 'fdba9d1b-32db-4b18-85c4-a5f2e680dcec',
        content: '# Chapter 1\n\nHooray',
        contentHash: 'hash',
        updatedAt: '2026-09-15T10:05:00.000Z',
      });

      const res = await uut.updateContent(
        '4bbc4da9-107c-4872-9809-78f6191a092d',
        '# Chapter 1\n\nHooray',
        '2026-09-15T10:00:00.000Z',
      );

      expect(
        chapterContentRepository.upsertByChapterId,
      ).toHaveBeenCalledWith(
        '4bbc4da9-107c-4872-9809-78f6191a092d',
        '# Chapter 1\n\nHooray',
      );
      expect(res.chapter.contentId).toBe(
        'fdba9d1b-32db-4b18-85c4-a5f2e680dcec',
      );
      expect(res.contentChanged).toBeTrue();
    });

    it('should skip the write entirely and report contentChanged as false when the saved content hashes the same as what is already stored (no-op save)', async () => {
      const chapter = {
        id: '4bbc4da9-107c-4872-9809-78f6191a092d',
        novelId: '4754496a-ccb4-4a6b-805d-809a6cea97c8',
        contentId: 'fdba9d1b-32db-4b18-85c4-a5f2e680dcec',
        title: 'Chapter 1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      vi.mocked(chapterRepository.findById).mockResolvedValue(
        chapter,
      );
      vi.mocked(
        chapterContentRepository.findByChapterId,
      ).mockResolvedValue({
        id: 'fdba9d1b-32db-4b18-85c4-a5f2e680dcec',
        content: '# Chapter 1',
        contentHash:
          'ead29642732d3e89a6e19f945510260754c140f8e21a5b30699a37239dca9bb5',
        updatedAt: '2026-09-15T10:00:00.000Z',
      });

      const res = await uut.updateContent(
        '4bbc4da9-107c-4872-9809-78f6191a092d',
        '# Chapter 1',
        '2026-09-15T10:00:00.000Z',
      );

      expect(res).toEqual({ chapter, contentChanged: false });
      expect(
        chapterContentRepository.upsertByChapterId,
      ).not.toHaveBeenCalled();
    });

    it('should raise an exception if chapter does NOT exist', async () => {
      vi.mocked(chapterRepository.findById).mockResolvedValue(null);

      const res = uut.updateContent(
        '761ba2ab-8d2f-46b0-8cf2-11f072be3bba',
        '# Chapter 1\n\nHello',
        '2026-09-15T10:00:00.000Z',
      );

      await expect(res).rejects.toThrow(NotFoundException);
    });

    it("should raise ConflictException and NOT write when the expected version doesn't match the chapter's current content version", async () => {
      vi.mocked(chapterRepository.findById).mockResolvedValue({
        id: '4bbc4da9-107c-4872-9809-78f6191a092d',
        novelId: '4754496a-ccb4-4a6b-805d-809a6cea97c8',
        contentId: 'fdba9d1b-32db-4b18-85c4-a5f2e680dcec',
        title: 'Chapter 1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      vi.mocked(
        chapterContentRepository.findByChapterId,
      ).mockResolvedValue({
        id: 'fdba9d1b-32db-4b18-85c4-a5f2e680dcec',
        content: '# Chapter 1\n\nSomeone else already edited this',
        contentHash: 'hash',
        updatedAt: '2026-09-15T10:05:00.000Z',
      });

      const res = uut.updateContent(
        '4bbc4da9-107c-4872-9809-78f6191a092d',
        '# Chapter 1\n\nHooray',
        '2026-09-15T10:00:00.000Z',
      );

      await expect(res).rejects.toThrow(ConflictException);
      expect(
        chapterContentRepository.upsertByChapterId,
      ).not.toHaveBeenCalled();
    });
  });
});

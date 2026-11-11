import { BadRequestException } from '@nestjs/common';

import type {
  IChapterRepository,
  IChapterUserStateRepository,
} from '../interfaces';

import { ChapterUserStateService } from './chapter-user-state.service';

describe(ChapterUserStateService.name, () => {
  let uut: ChapterUserStateService;
  let chapterUserStateRepository: IChapterUserStateRepository;
  let chapterRepository: IChapterRepository;

  beforeEach(() => {
    chapterUserStateRepository = {
      markChaptersRead: vi.fn(),
      findReadChapterIds: vi.fn(),
      batchLoadByChapterIds: vi.fn(),
      deleteAllForUser: vi.fn(),
    } as any;
    chapterRepository = {
      findManyBy: vi.fn(),
      findById: vi.fn(),
      getChapter: vi.fn(),
    } as any;

    uut = new ChapterUserStateService(
      chapterUserStateRepository,
      chapterRepository,
    );
  });

  describe('markChaptersRead', () => {
    it('should mark multiple chapters as read and return count', async () => {
      const userId = '696847884920105041';
      const chapterIds = [
        'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
        '904bf826-33be-4172-b63f-665bba9007b9',
      ];
      vi.mocked(chapterRepository.findManyBy).mockResolvedValue([
        {
          id: 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
          novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
          title: 'Chapter 1',
          chapterNumber: 1,
          contentId: 'ccc63ad5-1ac4-46c2-a25f-6f62d245f44c',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
        {
          id: '904bf826-33be-4172-b63f-665bba9007b9',
          novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
          title: 'Chapter 2',
          chapterNumber: 2,
          contentId: 'ddd63ad5-1ac4-46c2-a25f-6f62d245f44c',
          createdAt: '2024-01-03T00:00:00.000Z',
          updatedAt: '2024-01-04T00:00:00.000Z',
        },
      ]);
      vi.mocked(
        chapterUserStateRepository.markChaptersRead,
      ).mockResolvedValue(2);

      const result = await uut.markChaptersRead(userId, chapterIds);

      expect(result).toBe(2);
      expect(chapterRepository.findManyBy).toHaveBeenCalledWith(
        chapterIds,
      );
      expect(
        chapterUserStateRepository.markChaptersRead,
      ).toHaveBeenCalledWith(userId, [
        {
          chapterId: 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
          novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
        },
        {
          chapterId: '904bf826-33be-4172-b63f-665bba9007b9',
          novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
        },
      ]);
    });

    it('should return 0 when empty chapter IDs array is provided', async () => {
      const userId = '696847885112993802';

      const result = await uut.markChaptersRead(userId, []);

      expect(result).toBe(0);
      expect(chapterRepository.findManyBy).not.toHaveBeenCalled();
      expect(
        chapterUserStateRepository.markChaptersRead,
      ).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when exceeding max size', async () => {
      const userId = '696847885347221019';
      const chapterIds = Array.from(
        { length: 101 },
        (_, i) => `chapter-id-${i}`,
      );

      const result = uut.markChaptersRead(userId, chapterIds);

      await expect(result).rejects.toThrow(BadRequestException);
      await expect(result).rejects.toThrow(
        'Maximum 100 chapters can be marked as read per request',
      );
      expect(chapterRepository.findManyBy).not.toHaveBeenCalled();
    });

    it('should return 0 when no valid chapters found', async () => {
      const userId = '696847885991032774';
      const chapterIds = ['non-existent-uuid'];
      vi.mocked(chapterRepository.findManyBy).mockResolvedValue([]);

      const result = await uut.markChaptersRead(userId, chapterIds);

      expect(result).toBe(0);
      expect(chapterRepository.findManyBy).toHaveBeenCalledWith(
        chapterIds,
      );
      expect(
        chapterUserStateRepository.markChaptersRead,
      ).not.toHaveBeenCalled();
    });

    it('should handle partial chapter validation', async () => {
      const userId = '696847886420118563';
      const chapterIds = [
        'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
        'non-existent-uuid',
        '904bf826-33be-4172-b63f-665bba9007b9',
      ];
      const mockChapters = [
        {
          id: 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
          novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
          title: 'Chapter 1',
          chapterNumber: 1,
          contentId: 'ccc63ad5-1ac4-46c2-a25f-6f62d245f44c',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
        {
          id: '904bf826-33be-4172-b63f-665bba9007b9',
          novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
          title: 'Chapter 2',
          chapterNumber: 2,
          contentId: 'ddd63ad5-1ac4-46c2-a25f-6f62d245f44c',
          createdAt: '2024-01-03T00:00:00.000Z',
          updatedAt: '2024-01-04T00:00:00.000Z',
        },
      ];
      vi.mocked(chapterRepository.findManyBy).mockResolvedValue(
        mockChapters as any,
      );
      vi.mocked(
        chapterUserStateRepository.markChaptersRead,
      ).mockResolvedValue(2);

      const result = await uut.markChaptersRead(userId, chapterIds);

      expect(result).toBe(2);
      expect(chapterRepository.findManyBy).toHaveBeenCalledWith(
        chapterIds,
      );
      expect(
        chapterUserStateRepository.markChaptersRead,
      ).toHaveBeenCalledWith(userId, [
        {
          chapterId: 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
          novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
        },
        {
          chapterId: '904bf826-33be-4172-b63f-665bba9007b9',
          novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
        },
      ]);
    });

    it('should handle chapters from different novels', async () => {
      const userId = '696847887662104908';
      const chapterIds = [
        'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
        '904bf826-33be-4172-b63f-665bba9007b9',
      ];
      const mockChapters = [
        {
          id: 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
          novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
          title: 'Chapter 1',
          chapterNumber: 1,
          contentId: 'ccc63ad5-1ac4-46c2-a25f-6f62d245f44c',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
        {
          id: '904bf826-33be-4172-b63f-665bba9007b9',
          novelId: '86537331-b426-4081-aa4e-e58daf533a97',
          title: 'Different Novel Chapter',
          chapterNumber: 1,
          contentId: 'ddd63ad5-1ac4-46c2-a25f-6f62d245f44c',
          createdAt: '2024-01-03T00:00:00.000Z',
          updatedAt: '2024-01-04T00:00:00.000Z',
        },
      ];
      vi.mocked(chapterRepository.findManyBy).mockResolvedValue(
        mockChapters,
      );
      vi.mocked(
        chapterUserStateRepository.markChaptersRead,
      ).mockResolvedValue(2);

      const result = await uut.markChaptersRead(userId, chapterIds);

      expect(result).toBe(2);
      expect(
        chapterUserStateRepository.markChaptersRead,
      ).toHaveBeenCalledWith(userId, [
        {
          chapterId: 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c',
          novelId: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
        },
        {
          chapterId: '904bf826-33be-4172-b63f-665bba9007b9',
          novelId: '86537331-b426-4081-aa4e-e58daf533a97',
        },
      ]);
    });
  });

  describe('deleteReadHistory', () => {
    it('should delete all read history for a user', async () => {
      const userId = '696847888177889345';
      vi.mocked(
        chapterUserStateRepository.deleteAllForUser,
      ).mockResolvedValue(10);

      const result = await uut.deleteReadHistory(userId);

      expect(result).toBe(10);
      expect(
        chapterUserStateRepository.deleteAllForUser,
      ).toHaveBeenCalledWith(userId);
    });
  });
});

import type { IChapter, IChapterRepository } from '../interfaces';

import { ChapterNavigationDataLoader } from './chapter-navigation.dataloader';

describe(ChapterNavigationDataLoader.name, () => {
  let uut: ChapterNavigationDataLoader;
  let chapterRepository: IChapterRepository;

  beforeEach(() => {
    chapterRepository = {
      findById: vi.fn(),
      findManyBy: vi.fn(),
      getChapter: vi.fn(),
      countChapters: vi.fn(),
      getLastChapter: vi.fn(),
      getFirstChapter: vi.fn(),
      updateNarrationStatus: vi.fn(),
      findChaptersPage: vi.fn(),
      updateChapterNarrationUrl: vi.fn(),
      updateChapterNarrationComplete: vi.fn(),
      findManyByNovelAndChapterNumbers: vi.fn(),
    } as any;

    uut = new ChapterNavigationDataLoader(chapterRepository);
  });

  it('should return the next chapter', async () => {
    const novelId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const nextChapter: IChapter = {
      id: 'c0000002-0000-0000-0000-000000000002',
      novelId,
      contentId: 'cnt-00002-0000-0000-0000-000000000001',
      title: 'Chapter 2: The Journey',
      chapterNumber: 2,
      createdAt: '2024-01-03T00:00:00.000Z',
      updatedAt: '2024-01-04T00:00:00.000Z',
    };
    vi.mocked(
      chapterRepository.findManyByNovelAndChapterNumbers,
    ).mockResolvedValue([nextChapter]);

    const result = await uut.load({
      novelId,
      chapterNumber: 1,
      adjacency: 'next',
    });

    expect(result).toStrictEqual(nextChapter);
    expect(
      chapterRepository.findManyByNovelAndChapterNumbers,
    ).toHaveBeenCalledWith([{ novelId, chapterNumber: 2 }]);
  });

  it('should return the previous chapter', async () => {
    const novelId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const previousChapter: IChapter = {
      id: 'c0000001-0000-0000-0000-000000000001',
      novelId,
      contentId: 'cnt-00001-0000-0000-0000-000000000001',
      title: 'Chapter 1: The Beginning',
      chapterNumber: 1,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    };
    vi.mocked(
      chapterRepository.findManyByNovelAndChapterNumbers,
    ).mockResolvedValue([previousChapter]);

    const result = await uut.load({
      novelId,
      chapterNumber: 2,
      adjacency: 'previous',
    });

    expect(result).toStrictEqual(previousChapter);
    expect(
      chapterRepository.findManyByNovelAndChapterNumbers,
    ).toHaveBeenCalledWith([{ novelId, chapterNumber: 1 }]);
  });

  it('should return null when chapter is the last and adjacency is next', async () => {
    const novelId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    vi.mocked(
      chapterRepository.findManyByNovelAndChapterNumbers,
    ).mockResolvedValue([]);

    const result = await uut.load({
      novelId,
      chapterNumber: 4,
      adjacency: 'next',
    });

    expect(result).toBeNull();
  });

  it('should return null when chapter is the first and adjacency is previous', async () => {
    const novelId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

    const result = await uut.load({
      novelId,
      chapterNumber: 1,
      adjacency: 'previous',
    });

    expect(result).toBeNull();
    expect(
      chapterRepository.findManyByNovelAndChapterNumbers,
    ).not.toHaveBeenCalled();
  });

  it('should batch multiple navigation requests into a single findManyByNovelAndChapterNumbers call', async () => {
    const novelId = '949ce142-f880-4c61-b86f-a1fccdb84fee';
    vi.mocked(
      chapterRepository.findManyByNovelAndChapterNumbers,
    ).mockResolvedValue([]);

    const [nextOfFirst] = await Promise.all([
      uut.load({
        novelId,
        chapterNumber: 1,
        adjacency: 'next',
      }),
    ]);

    expect(nextOfFirst).toBeDefined();
    expect(
      chapterRepository.findManyByNovelAndChapterNumbers,
    ).toHaveBeenCalledWith([{ novelId, chapterNumber: 2 }]);
  });
});

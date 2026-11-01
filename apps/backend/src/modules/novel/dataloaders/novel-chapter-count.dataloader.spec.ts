import { NovelChapterCountDataLoader } from './novel-chapter-count.dataloader';

const novelId = 'c1d31ec2-f478-4648-b90b-d1e53de2a829';
const otherNovelId = '248c9fee-cad0-43fc-9abb-c2ab8ff002ec';

describe(NovelChapterCountDataLoader.name, () => {
  it('should ask once for all the novels of a page and give 0 to one the estimate left out', async () => {
    const novelService = {
      estimateChapterCounts: vi
        .fn()
        .mockResolvedValue(new Map([[novelId, 12]])),
    };
    const uut = new NovelChapterCountDataLoader(
      novelService as never,
    );

    const results = await Promise.all([
      uut.load(novelId),
      uut.load(otherNovelId),
    ]);

    expect(results).toStrictEqual([12, 0]);
    expect(
      novelService.estimateChapterCounts,
    ).toHaveBeenCalledExactlyOnceWith([novelId, otherNovelId]);
  });
});

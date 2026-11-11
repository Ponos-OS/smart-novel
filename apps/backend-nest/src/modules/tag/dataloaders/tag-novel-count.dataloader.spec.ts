import type { TagService } from '../services';

import { TagNovelCountDataLoader } from './tag-novel-count.dataloader';

describe(TagNovelCountDataLoader.name, () => {
  const fantasyId = '5b2c0f3e-0a53-4d3c-9d2c-9a3d1f7f4a10';
  const mysteryId = 'c1d4a7f2-6e58-4b39-8a64-2f0e9b7d3c55';
  let uut: TagNovelCountDataLoader;
  let tagService: TagService;

  beforeEach(() => {
    tagService = { estimateNovelCounts: vi.fn() } as any;
    uut = new TagNovelCountDataLoader(tagService);
  });

  it('should estimate the tags of concurrent loads in one batch, once per distinct id', async () => {
    vi.mocked(tagService.estimateNovelCounts).mockResolvedValue(
      new Map([
        [fantasyId, 1203],
        [mysteryId, 7],
      ]),
    );

    const result = await Promise.all([
      uut.load(fantasyId),
      uut.load(mysteryId),
      uut.load(fantasyId),
    ]);

    expect(result).toEqual([1203, 7, 1203]);
    expect(
      tagService.estimateNovelCounts,
    ).toHaveBeenCalledExactlyOnceWith([fantasyId, mysteryId]);
  });

  it('should answer 0 for a tag the service returned nothing for', async () => {
    vi.mocked(tagService.estimateNovelCounts).mockResolvedValue(
      new Map(),
    );

    const result = await uut.load(fantasyId);

    expect(result).toBe(0);
  });
});

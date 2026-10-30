import type { CategoryService } from '../services';

import { CategoryNovelCountDataLoader } from './category-novel-count.dataloader';

describe(CategoryNovelCountDataLoader.name, () => {
  const fantasyId = '5b2c0f3e-0a53-4d3c-9d2c-9a3d1f7f4a10';
  const mysteryId = 'c1d4a7f2-6e58-4b39-8a64-2f0e9b7d3c55';
  let uut: CategoryNovelCountDataLoader;
  let categoryService: CategoryService;

  beforeEach(() => {
    categoryService = { estimateNovelCounts: vi.fn() } as any;
    uut = new CategoryNovelCountDataLoader(categoryService);
  });

  it('should estimate the categories of concurrent loads in one batch, once per distinct id', async () => {
    vi.mocked(categoryService.estimateNovelCounts).mockResolvedValue(
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
      categoryService.estimateNovelCounts,
    ).toHaveBeenCalledExactlyOnceWith([fantasyId, mysteryId]);
  });

  it('should answer 0 for a category the service returned nothing for', async () => {
    vi.mocked(categoryService.estimateNovelCounts).mockResolvedValue(
      new Map(),
    );

    const result = await uut.load(fantasyId);

    expect(result).toBe(0);
  });
});

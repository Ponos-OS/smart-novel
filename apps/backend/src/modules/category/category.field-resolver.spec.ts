import { CategoryStatus } from '@prisma/client';

import type { CategoryNovelCountDataLoader } from './dataloaders';

import { CategoryFieldResolver } from './category.field-resolver';

describe(CategoryFieldResolver.name, () => {
  it('should resolve the approximate novel count through the loader', async () => {
    const category = {
      id: '5b2c0f3e-0a53-4d3c-9d2c-9a3d1f7f4a10',
      name: 'fantasy',
      status: CategoryStatus.APPROVED,
    };
    const loader = { load: vi.fn().mockResolvedValue(1203) };
    const uut = new CategoryFieldResolver(
      loader as unknown as CategoryNovelCountDataLoader,
    );

    const result = await uut.approximateNovelCount(category);

    expect(loader.load).toHaveBeenCalledExactlyOnceWith(category.id);
    expect(result).toBe(1203);
  });
});

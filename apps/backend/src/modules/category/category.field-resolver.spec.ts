import { CategoryStatus } from '@prisma/client';
import { Role } from '@smart-novel/shared';

import type { IAuthUser } from '../auth';
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

  describe('requesterUserId', () => {
    const category = {
      id: '5b2c0f3e-0a53-4d3c-9d2c-9a3d1f7f4a10',
      name: 'slice of life',
      status: CategoryStatus.PENDING,
      requesterUserId: '300311094522198754',
    };
    const uut = new CategoryFieldResolver({} as any);

    it.each([
      {
        caller: 'an admin',
        user: { roles: [Role.admin] },
        expected: '300311094522198754',
      },
      {
        caller: 'a writer',
        user: { roles: [Role.writer] },
        expected: null,
      },
      {
        caller: 'an anonymous caller',
        user: undefined,
        expected: null,
      },
    ])('should give $caller $expected', ({ user, expected }) => {
      const result = uut.requesterUserId(
        category,
        user as IAuthUser | undefined,
      );

      expect(result).toBe(expected);
    });

    it('should answer null for a category nobody requested', () => {
      const result = uut.requesterUserId(
        { ...category, requesterUserId: null },
        { roles: [Role.admin] } as IAuthUser,
      );

      expect(result).toBeNull();
    });
  });
});

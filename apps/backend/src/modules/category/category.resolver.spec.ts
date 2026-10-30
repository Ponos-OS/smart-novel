import { CategoryStatus } from '@prisma/client';
import { Role } from '@smart-novel/shared';

import type { IAuthUser } from '../auth';

import { CategoryResolver } from './category.resolver';
import { CategoryService } from './services';
import { CategoryConnection } from './types';

describe(CategoryResolver.name, () => {
  let uut: CategoryResolver;
  let categoryService: CategoryService;

  beforeEach(() => {
    categoryService = {
      findConnection: vi.fn(),
      request: vi.fn(),
      approve: vi.fn(),
      rename: vi.fn(),
      delete: vi.fn(),
    } as any;
    uut = new CategoryResolver(categoryService);
  });

  it.each([
    { caller: 'anonymous', user: undefined, isAdmin: false },
    {
      caller: 'a writer',
      user: { sub: '300311094522198754', roles: [Role.writer] },
      isAdmin: false,
    },
    {
      caller: 'an admin',
      user: { sub: '240311094522198754', roles: [Role.admin] },
      isAdmin: true,
    },
  ])(
    'should tell the service whether $caller is an admin',
    async ({ user, isAdmin }) => {
      const after = Buffer.from(
        '5b2c0f3e-0a53-4d3c-9d2c-9a3d1f7f4a10',
      ).toString('base64');
      const connection = new CategoryConnection();
      const filters = { statuses: [CategoryStatus.PENDING] };
      vi.mocked(categoryService.findConnection).mockResolvedValue(
        connection,
      );

      const result = await uut.categoriesConnection(
        user as IAuthUser | undefined,
        10,
        undefined,
        after,
        undefined,
        filters,
      );

      expect(
        categoryService.findConnection,
      ).toHaveBeenCalledExactlyOnceWith(
        isAdmin,
        {
          first: 10,
          last: undefined,
          after: after,
          before: undefined,
        },
        filters,
      );
      expect(result).toBe(connection);
    },
  );

  describe('mutations', () => {
    const id = '5b2c0f3e-0a53-4d3c-9d2c-9a3d1f7f4a10';
    const category = {
      id,
      name: 'fantasy',
      status: CategoryStatus.APPROVED,
    };

    it('should request the category for the caller', async () => {
      vi.mocked(categoryService.request).mockResolvedValue(category);

      const result = await uut.requestCategory('Fantasy', {
        sub: '300311094522198754',
      } as IAuthUser);

      expect(categoryService.request).toHaveBeenCalledExactlyOnceWith(
        '300311094522198754',
        'Fantasy',
      );
      expect(result).toBe(category);
    });

    it('should approve by id', async () => {
      vi.mocked(categoryService.approve).mockResolvedValue(category);

      const result = await uut.approveCategory(id);

      expect(categoryService.approve).toHaveBeenCalledExactlyOnceWith(
        id,
      );
      expect(result).toBe(category);
    });

    it('should rename by id', async () => {
      vi.mocked(categoryService.rename).mockResolvedValue(category);

      const result = await uut.updateCategory(id, 'epic');

      expect(categoryService.rename).toHaveBeenCalledExactlyOnceWith(
        id,
        'epic',
      );
      expect(result).toBe(category);
    });

    it('should delete by id', async () => {
      vi.mocked(categoryService.delete).mockResolvedValue({ id });

      const result = await uut.deleteCategory(id);

      expect(categoryService.delete).toHaveBeenCalledExactlyOnceWith(
        id,
      );
      expect(result).toEqual({ id });
    });
  });
});

import { TagStatus } from '@prisma/client';
import { Role } from '@smart-novel/shared';

import type { IAuthUser } from '../auth';
import type { TagNovelCountDataLoader } from './dataloaders';

import { TagFieldResolver } from './tag.field-resolver';

describe(TagFieldResolver.name, () => {
  it('should resolve the approximate novel count through the loader', async () => {
    const tag = {
      id: '5b2c0f3e-0a53-4d3c-9d2c-9a3d1f7f4a10',
      name: 'fantasy',
      status: TagStatus.APPROVED,
    };
    const loader = { load: vi.fn().mockResolvedValue(1203) };
    const uut = new TagFieldResolver(
      loader as unknown as TagNovelCountDataLoader,
    );

    const result = await uut.approximateNovelCount(tag);

    expect(loader.load).toHaveBeenCalledExactlyOnceWith(tag.id);
    expect(result).toBe(1203);
  });

  describe('requesterUserId', () => {
    const tag = {
      id: '5b2c0f3e-0a53-4d3c-9d2c-9a3d1f7f4a10',
      name: 'slice of life',
      status: TagStatus.PENDING,
      requesterUserId: '300311094522198754',
    };
    const uut = new TagFieldResolver({} as any);

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
        tag,
        user as IAuthUser | undefined,
      );

      expect(result).toBe(expected);
    });

    it('should answer null for a tag nobody requested', () => {
      const result = uut.requesterUserId(
        { ...tag, requesterUserId: null },
        { roles: [Role.admin] } as IAuthUser,
      );

      expect(result).toBeNull();
    });
  });
});

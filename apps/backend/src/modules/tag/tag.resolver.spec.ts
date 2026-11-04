import { TagStatus } from '@prisma/client';
import { Role } from '@smart-novel/shared';

import type { IAuthUser } from '../auth';

import { TagService } from './services';
import { TagResolver } from './tag.resolver';
import { TagConnection } from './types';

describe(TagResolver.name, () => {
  let uut: TagResolver;
  let tagService: TagService;

  beforeEach(() => {
    tagService = {
      findConnection: vi.fn(),
      request: vi.fn(),
      create: vi.fn(),
      approve: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as any;
    uut = new TagResolver(tagService);
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
      const connection = new TagConnection();
      const filters = { statuses: [TagStatus.PENDING] };
      vi.mocked(tagService.findConnection).mockResolvedValue(
        connection,
      );

      const result = await uut.tagsConnection(
        user as IAuthUser | undefined,
        10,
        undefined,
        after,
        undefined,
        filters,
      );

      expect(
        tagService.findConnection,
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
    const tag = {
      id,
      name: 'fantasy',
      status: TagStatus.APPROVED,
    };

    it('should request the tag for the caller', async () => {
      vi.mocked(tagService.request).mockResolvedValue(tag);

      const input = {
        name: 'fantasy',
        description: 'Worlds with magic and quests.',
      };

      const result = await uut.requestTag(input, {
        sub: '300311094522198754',
      } as IAuthUser);

      expect(tagService.request).toHaveBeenCalledExactlyOnceWith(
        '300311094522198754',
        input,
      );
      expect(result).toBe(tag);
    });

    it('should create the tag', async () => {
      vi.mocked(tagService.create).mockResolvedValue(tag);
      const input = {
        name: 'fantasy',
        description: 'Worlds with magic and quests.',
      };

      const result = await uut.createTag(input);

      expect(tagService.create).toHaveBeenCalledExactlyOnceWith(
        input,
      );
      expect(result).toBe(tag);
    });

    it('should approve by id', async () => {
      vi.mocked(tagService.approve).mockResolvedValue(tag);

      const result = await uut.approveTag(id);

      expect(tagService.approve).toHaveBeenCalledExactlyOnceWith(id);
      expect(result).toBe(tag);
    });

    it('should update by id', async () => {
      vi.mocked(tagService.update).mockResolvedValue(tag);
      const input = { name: 'epic', description: 'Grand stories.' };

      const result = await uut.updateTag(id, input);

      expect(tagService.update).toHaveBeenCalledExactlyOnceWith(
        id,
        input,
      );
      expect(result).toBe(tag);
    });

    it('should delete by id', async () => {
      vi.mocked(tagService.delete).mockResolvedValue({ id });

      const result = await uut.deleteTag(id);

      expect(tagService.delete).toHaveBeenCalledExactlyOnceWith(id);
      expect(result).toEqual({ id });
    });
  });
});

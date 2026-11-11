import { Role } from '@smart-novel/shared';

import { type IAuthUser } from '../../auth';
import { NovelWriterDataLoader } from '../dataloaders';
import { Novel } from '../types';
import { NovelWriterFieldResolver } from './novel-writer.field-resolver';

describe(NovelWriterFieldResolver.name, () => {
  const novel = {
    id: 'c1d31ec2-f478-4648-b90b-d1e53de2a829',
    writerId: '5b2c0f3e-0a53-4d3c-9d2c-9a3d1f7f4a10',
  } as Novel;
  const writer = {
    userId: '364554362883670018',
    penName: 'Mina_Ardalan',
  };
  let uut: NovelWriterFieldResolver;
  let loader: { load: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    loader = { load: vi.fn().mockResolvedValue(writer) };
    uut = new NovelWriterFieldResolver(
      loader as unknown as NovelWriterDataLoader,
    );
  });

  it.each([
    {
      viewer: 'an anonymous caller',
      user: undefined,
      isAdmin: false,
    },
    {
      viewer: 'a user',
      user: { roles: [Role.user] } as IAuthUser,
      isAdmin: false,
    },
    {
      viewer: 'a writer',
      user: { roles: [Role.writer] } as IAuthUser,
      isAdmin: false,
    },
    {
      viewer: 'an admin',
      user: { roles: [Role.admin] } as IAuthUser,
      isAdmin: true,
    },
  ])(
    'should load the writer of the novel for $viewer',
    async ({ user, isAdmin }) => {
      const result = await uut.writer(novel, user);

      expect(result).toBe(writer);
      expect(loader.load).toHaveBeenCalledExactlyOnceWith(
        { novelId: novel.id, writerId: novel.writerId },
        isAdmin,
      );
    },
  );
});

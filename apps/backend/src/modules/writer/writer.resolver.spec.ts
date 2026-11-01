import { WriterStatus } from '@prisma/client';
import { Role } from '@smart-novel/shared';

import { type IAuthUser } from '../auth';
import { WriterResolver } from './writer.resolver';
import { WriterService } from './writer.service';

describe(WriterResolver.name, () => {
  const user = {
    sub: '364554362883670018',
    roles: [Role.user],
  } as IAuthUser;
  let uut: WriterResolver;
  let service: Record<
    | 'request'
    | 'findLatest'
    | 'findConnection'
    | 'approve'
    | 'reject',
    ReturnType<typeof vi.fn>
  >;

  beforeEach(() => {
    service = {
      request: vi.fn(),
      findLatest: vi.fn(),
      findConnection: vi.fn(),
      approve: vi.fn(),
      reject: vi.fn(),
    };
    uut = new WriterResolver(service as unknown as WriterService);
  });

  it('should hand the caller and the note to the service', async () => {
    service.request.mockResolvedValue({ id: 'x' });

    await uut.requestWriterAccess('I write fantasy.', user);

    expect(service.request).toHaveBeenCalledWith(
      user,
      'I write fantasy.',
    );
  });

  it('should look up the latest request by the caller', async () => {
    service.findLatest.mockResolvedValue(null);

    const result = await uut.myWriter(user);

    expect(result).toBeNull();
    expect(service.findLatest).toHaveBeenCalledWith(user.sub);
  });

  it('should page the requests with the filters', async () => {
    await uut.writersConnection(5, undefined, 'abc', undefined, {
      status: WriterStatus.REJECTED,
    });

    expect(service.findConnection).toHaveBeenCalledWith(
      { first: 5, last: undefined, after: 'abc', before: undefined },
      { status: WriterStatus.REJECTED },
    );
  });

  it('should approve with the admin as the reviewer', async () => {
    const admin = { sub: '364554362732740610' } as IAuthUser;
    const id = '5b2c0f3e-0a53-4d3c-9d2c-9a3d1f7f4a10';

    await uut.approveWriter(id, admin);

    expect(service.approve).toHaveBeenCalledWith(id, admin.sub);
  });

  it('should reject with the admin as the reviewer and the reason', async () => {
    const admin = { sub: '364554362732740610' } as IAuthUser;
    const id = '5b2c0f3e-0a53-4d3c-9d2c-9a3d1f7f4a10';

    await uut.rejectWriter(id, admin, 'Share a sample chapter.');

    expect(service.reject).toHaveBeenCalledWith(
      id,
      admin.sub,
      'Share a sample chapter.',
    );
  });
});

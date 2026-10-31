import { Role } from '@smart-novel/shared';

import { type IAuthUser } from '../auth';
import { WriterRequestResolver } from './writer-request.resolver';
import { WriterRequestService } from './writer-request.service';

describe(WriterRequestResolver.name, () => {
  const user = {
    sub: '364554362883670018',
    roles: [Role.user],
  } as IAuthUser;
  let uut: WriterRequestResolver;
  let service: Record<
    'request' | 'findLatest',
    ReturnType<typeof vi.fn>
  >;

  beforeEach(() => {
    service = { request: vi.fn(), findLatest: vi.fn() };
    uut = new WriterRequestResolver(
      service as unknown as WriterRequestService,
    );
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

    const result = await uut.myWriterRequest(user);

    expect(result).toBeNull();
    expect(service.findLatest).toHaveBeenCalledWith(user.sub);
  });
});

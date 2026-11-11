import { Role } from '@smart-novel/shared';

import { ZitadelManagementClient } from '../auth';
import { ZitadelEventsController } from './zitadel-events.controller';

describe(ZitadelEventsController.name, () => {
  it('should grant the user role to the new user', async () => {
    const userId = '364554362883670018';
    const managementClient = {
      grantProjectRoleIfAbsent: vi.fn().mockResolvedValue(undefined),
    } as unknown as ZitadelManagementClient;
    const uut = new ZitadelEventsController(managementClient);

    await uut.userAdded(userId);

    expect(
      managementClient.grantProjectRoleIfAbsent,
    ).toHaveBeenCalledExactlyOnceWith(userId, Role.user);
  });
});

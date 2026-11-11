import { Role } from '@smart-novel/shared';
import axios from 'axios';
import { CustomLoggerService } from 'nestjs-backend-common';

import { AuthModuleOptions } from '../auth.module-definition';
import { ZitadelManagementClient } from './zitadel-management.client';

vi.mock('axios');

describe(ZitadelManagementClient.name, () => {
  const userId = '364554362883670018';
  const projectId = '364554334932959234';
  const grantId = '364554412732740610';
  const managementPat = 'pat-9f3c1d7e2a5b48c6b0e1d4f7a2c9e8b3';
  let uut: ZitadelManagementClient;
  let options: AuthModuleOptions;
  let logger: CustomLoggerService;

  beforeEach(() => {
    vi.clearAllMocks();
    options = {
      issuerUrl: 'http://localhost:8080',
      issuerInternalUrl: 'http://traefik:80',
      managementPat,
      projectId,
    } as AuthModuleOptions;
    logger = { error: vi.fn() } as any;
    uut = new ZitadelManagementClient(options, logger);
  });

  it('should create the grant when the user has none on the project', async () => {
    vi.mocked(axios.request)
      .mockResolvedValueOnce({ data: { result: [] } })
      .mockResolvedValueOnce({ data: {} });

    await uut.setUserProjectRole(userId, Role.writer);

    expect(axios.request).toHaveBeenNthCalledWith(1, {
      method: 'POST',
      url: 'http://traefik/management/v1/users/grants/_search',
      data: {
        queries: [
          { user_id_query: { user_id: userId } },
          { project_id_query: { project_id: projectId } },
        ],
      },
      headers: { Authorization: `Bearer ${managementPat}` },
    });
    expect(axios.request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        method: 'POST',
        url: `http://traefik/management/v1/users/${userId}/grants`,
        data: { projectId, roleKeys: [Role.writer] },
      }),
    );
  });

  it('should grant the role to a user without a grant', async () => {
    vi.mocked(axios.request)
      .mockResolvedValueOnce({ data: { result: [] } })
      .mockResolvedValueOnce({ data: {} });

    await uut.grantProjectRoleIfAbsent(userId, Role.user);

    expect(axios.request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        method: 'POST',
        url: `http://traefik/management/v1/users/${userId}/grants`,
        data: { projectId, roleKeys: [Role.user] },
      }),
    );
  });

  it('should keep the grant of a user who already has one', async () => {
    vi.mocked(axios.request).mockResolvedValueOnce({
      data: { result: [{ id: grantId, roleKeys: [Role.writer] }] },
    });

    await uut.grantProjectRoleIfAbsent(userId, Role.user);

    expect(axios.request).toHaveBeenCalledOnce();
  });

  it('should replace the roles of an existing grant', async () => {
    vi.mocked(axios.request)
      .mockResolvedValueOnce({
        data: { result: [{ id: grantId, roleKeys: [Role.user] }] },
      })
      .mockResolvedValueOnce({ data: {} });

    await uut.setUserProjectRole(userId, Role.writer);

    expect(axios.request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        method: 'PUT',
        url: `http://traefik/management/v1/users/${userId}/grants/${grantId}`,
        data: { roleKeys: [Role.writer] },
      }),
    );
  });

  it('should change nothing when the user already holds exactly the role', async () => {
    vi.mocked(axios.request).mockResolvedValueOnce({
      data: { result: [{ id: grantId, roleKeys: [Role.writer] }] },
    });

    await uut.setUserProjectRole(userId, Role.writer);

    expect(axios.request).toHaveBeenCalledOnce();
  });

  it('should throw and log the status without the token when ZITADEL answers non-2xx', async () => {
    vi.mocked(axios.request).mockRejectedValueOnce({
      message: `Request failed, Authorization: Bearer ${managementPat}`,
      response: { status: 403 },
    });

    const promise = uut.setUserProjectRole(userId, Role.writer);

    await expect(promise).rejects.toThrow(
      'ZITADEL management API request failed with status 403',
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('status 403'),
    );
    expect(
      vi.mocked(logger.error).mock.calls.flat().join(),
    ).not.toContain(managementPat);
  });
});

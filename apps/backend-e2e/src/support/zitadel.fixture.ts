import axios from 'axios';
import { randomUUID } from 'node:crypto';

import { config } from './config.helper';

export type ProjectRole = 'user' | 'writer' | 'admin';

interface UserGrant {
  id: string;
  roleKeys: string[];
}

/**
 * @description Talks to ZITADEL's API with the PAT of its first-instance machine user, the one Terraform authenticates with.
 */
export class ZitadelFixture {
  static async createHumanUser(): Promise<string> {
    const email = `fresh-${randomUUID()}@test.com`;

    const { data } = await ZitadelFixture.request<{ userId: string }>(
      'POST',
      ['v2', 'users', 'human'],
      {
        username: email,
        profile: { givenName: 'Fresh', familyName: 'User' },
        email: { email, isVerified: true },
      },
    );

    return data.userId;
  }

  /**
   * @description Makes `role` the only role the user holds on the project, whether or not the backend's `user.human.added` webhook has granted `user` yet.
   */
  static async setProjectRole(
    userId: string,
    role: ProjectRole,
  ): Promise<void> {
    const grant = await ZitadelFixture.findGrant(userId);

    if (!grant) {
      const created = await ZitadelFixture.createGrant(userId, role);

      if (created) {
        return;
      }
      // The webhook granted `user` between the search and the create.
      return ZitadelFixture.setProjectRole(userId, role);
    }
    // ZITADEL answers an update that changes nothing with an error.
    if (grant.roleKeys.length === 1 && grant.roleKeys[0] === role) {
      return;
    }

    await ZitadelFixture.request(
      'PUT',
      ['management', 'v1', 'users', userId, 'grants', grant.id],
      { roleKeys: [role] },
    );
  }

  private static async findGrant(
    userId: string,
  ): Promise<UserGrant | undefined> {
    const { data } = await ZitadelFixture.request<{
      result?: UserGrant[];
    }>('POST', ['management', 'v1', 'users', 'grants', '_search'], {
      queries: [
        { user_id_query: { user_id: userId } },
        { project_id_query: { project_id: config.projectId } },
      ],
    });

    return data.result?.[0];
  }

  /**
   * @returns `false` when the user already has a grant.
   */
  private static async createGrant(
    userId: string,
    role: ProjectRole,
  ) {
    const response = await ZitadelFixture.request(
      'POST',
      ['management', 'v1', 'users', userId, 'grants'],
      { projectId: config.projectId, roleKeys: [role] },
      [409],
    );

    return response.status !== 409;
  }

  private static request<T = unknown>(
    method: 'POST' | 'PUT',
    path: string[],
    data: object,
    tolerate: number[] = [],
  ) {
    return axios.request<T>({
      method,
      url: [config.zitadelIssuer, ...path].join('/'),
      data,
      headers: { Authorization: `Bearer ${config.zitadelPat}` },
      validateStatus: (status) =>
        (status >= 200 && status < 300) || tolerate.includes(status),
    });
  }
}

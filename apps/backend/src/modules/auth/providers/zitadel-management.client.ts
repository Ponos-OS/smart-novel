import { Inject, Injectable } from '@nestjs/common';
import { Role } from '@smart-novel/shared';
import axios, { type AxiosError } from 'axios';
import {
  CustomLoggerService,
  urlBuilder,
} from 'nestjs-backend-common';

import {
  type AuthModuleOptions,
  MODULE_OPTIONS_TOKEN,
} from '../auth.module-definition';
import { ZitadelUserGrantsSearchResponse } from '../interfaces';

@Injectable()
export class ZitadelManagementClient {
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions,
    private readonly logger: CustomLoggerService,
  ) {}

  /**
   * Makes `role` the only role the user holds on the project. Safe to call again with the same arguments.
   */
  async setUserProjectRole(
    userId: string,
    role: Role,
  ): Promise<void> {
    const { projectId } = this.options;

    const { result } =
      await this.request<ZitadelUserGrantsSearchResponse>(
        'POST',
        ['management', 'v1', 'users', 'grants', '_search'],
        {
          queries: [
            { user_id_query: { user_id: userId } },
            { project_id_query: { project_id: projectId } },
          ],
        },
      );
    const grant = result?.[0];

    if (!grant) {
      await this.request(
        'POST',
        ['management', 'v1', 'users', userId, 'grants'],
        {
          projectId,
          roleKeys: [role],
        },
      );
      return;
    }
    // ZITADEL answers an update that changes nothing with an error.
    if (grant.roleKeys.length === 1 && grant.roleKeys[0] === role) {
      return;
    }

    await this.request(
      'PUT',
      ['management', 'v1', 'users', userId, 'grants', grant.id],
      { roleKeys: [role] },
    );
  }

  private async request<T>(
    method: 'POST' | 'PUT',
    path: string[],
    data: object,
  ): Promise<T> {
    const url = urlBuilder(
      this.options.issuerInternalUrl ?? this.options.issuerUrl,
      ...path,
    );

    try {
      const response = await axios.request<T>({
        method,
        url,
        data,
        headers: {
          Authorization: `Bearer ${this.options.managementPat}`,
        },
      });

      return response.data;
    } catch (error) {
      // The axios error carries the request headers, so it must not be logged or rethrown.
      const status = (error as AxiosError).response?.status;

      this.logger.error(
        `ZITADEL management API ${method} /${path.join('/')} failed with status ${status}`,
      );
      throw new Error(
        `ZITADEL management API request failed with status ${status}`,
      );
    }
  }
}

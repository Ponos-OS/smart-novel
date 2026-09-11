// @ts-check

import { isEmpty, Logger } from '../utils/index.js';

export class ZitadelManagementV1Service {
  /**
   * @param {string} baseUrl - ZITADEL base URL
   * @param {string} accessToken - Bearer token for authentication
   */
  constructor(baseUrl, accessToken) {
    this.baseUrl = baseUrl;
    this.accessToken = accessToken;
  }

  /**
   * Create a project in ZITADEL
   * @param {string} projectName - Project name
   * @see https://zitadel.com/docs/reference/api/management/zitadel.management.v1.ManagementService.AddProject
   * @returns {Promise<string>} Project ID
   */
  async createProject(projectName) {
    const response = await fetch(
      `${this.baseUrl}/management/v1/projects`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: projectName,
          projectRoleAssertion: true,
        }),
      },
    );

    const data = await response.json();

    if (data.id) {
      return data.id;
    }

    // Check if project already exists
    if (JSON.stringify(data).toLowerCase().includes('already')) {
      return await this.#findProjectByName(projectName);
    }

    Logger.error(
      `Failed to create project: ${JSON.stringify(data, null, 2)}`,
    );
    throw new Error(`Failed to create project`);
  }

  /**
   * Create a role in a project
   * @param {string} projectId - Project ID
   * @param {Object} role - Role configuration
   * @param {string} role.group - Role group
   * @param {string} role.roleKey - Role key (e.g., 'admin', 'writer', 'user')
   * @param {string} role.displayName - Role display name
   * @see https://zitadel.com/docs/reference/api/management/zitadel.management.v1.ManagementService.AddProjectRole
   * @returns {Promise<void>}
   */
  async createProjectRole(
    projectId,
    { roleKey, displayName, group },
  ) {
    const response = await fetch(
      `${this.baseUrl}/management/v1/projects/${projectId}/roles`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          group,
          roleKey,
          displayName,
        }),
      },
    );
    const data = await response.json();
    const responseText = JSON.stringify(data).toLowerCase();
    const success =
      responseText.includes('already') ||
      responseText.includes('details');

    if (!success) {
      Logger.error(
        `Failed to create role '${roleKey}' in project '${projectId}': ${JSON.stringify(data, null, 2)}`,
      );
      throw new Error('Failed to create role');
    }
  }

  /**
   * @summary create an OIDC application.
   *
   * If the app already exists, this will return its clientId and `clientSecret: null`.
   *
   * @param {string} projectId - Project ID
   * @param {string} appName - Application name
   * @param {'public'|'confidential'} [kind='public'] - OIDC app kind
   * @see https://zitadel.com/docs/reference/api/management/zitadel.management.v1.ManagementService.AddOIDCApp
   * @returns {Promise<{appId: string, clientId: string, clientSecret: (string|null), oidcConfig: Record<string, any>}>} public apps do NOT have **client secrets**; for confidential apps the secret is returned.
   */
  async createOidcApp(projectId, appName, kind = 'public') {
    /** @type {Record<string, any>} */
    const payload =
      kind === 'confidential'
        ? {
            name: appName,
            redirectUris: ['http://localhost:8080/dummy/callback'],
            postLogoutRedirectUris: [],
            responseTypes: ['OIDC_RESPONSE_TYPE_CODE'],
            grantTypes: [
              'OIDC_GRANT_TYPE_REFRESH_TOKEN',
              'OIDC_GRANT_TYPE_TOKEN_EXCHANGE',
              'OIDC_GRANT_TYPE_AUTHORIZATION_CODE',
              'OIDC_GRANT_TYPE_CLIENT_CREDENTIALS',
            ],
            appType: 'OIDC_APP_TYPE_WEB',
            authMethodType: 'OIDC_AUTH_METHOD_TYPE_BASIC',
            devMode: true,
            accessTokenType: 'OIDC_TOKEN_TYPE_JWT',
            accessTokenRoleAssertion: true,
            idTokenRoleAssertion: true,
          }
        : {
            name: appName,
            redirectUris: ['http://localhost:8080/auth/callback'],
            postLogoutRedirectUris: ['http://localhost:8080'],
            responseTypes: ['OIDC_RESPONSE_TYPE_CODE'],
            grantTypes: [
              'OIDC_GRANT_TYPE_AUTHORIZATION_CODE',
              'OIDC_GRANT_TYPE_TOKEN_EXCHANGE',
            ],
            appType: 'OIDC_APP_TYPE_NATIVE',
            authMethodType: 'OIDC_AUTH_METHOD_TYPE_NONE',
            devMode: true,
            accessTokenType: 'OIDC_TOKEN_TYPE_JWT',
            accessTokenRoleAssertion: true,
            idTokenRoleAssertion: true,
          };
    const response = await fetch(
      `${this.baseUrl}/management/v1/projects/${projectId}/apps/oidc`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );
    const data = await response.json();
    // Strip `name` — it's not part of the OIDC config update payload
    const { name: _name, ...oidcConfig } = payload;

    if (data.clientId) {
      return {
        appId: data.appId,
        clientId: data.clientId,
        clientSecret: data.clientSecret ?? null,
        oidcConfig,
      };
    }

    if (JSON.stringify(data).toLowerCase().includes('already')) {
      const app = await this.#findApp(projectId, appName);
      return {
        appId: app.id,
        clientId: app.oidcConfig.clientId,
        clientSecret: null,
        oidcConfig,
      };
    }

    Logger.error(
      `Failed to create ${kind} OIDC app: ${JSON.stringify(data, null, 2)}`,
    );
    throw new Error('OIDC app creation failed!');
  }

  /**
   * Assign a role to a user
   * @param {string} userId - User ID
   * @param {string} projectId - Project ID
   * @param {string} roleKey - Role key to assign
   * @see https://zitadel.com/docs/reference/api/management/zitadel.management.v1.ManagementService.AddUserGrant
   * @returns {Promise<void>}
   */
  async assignRoleToUser(userId, projectId, roleKey) {
    const response = await fetch(
      `${this.baseUrl}/management/v1/users/${userId}/grants`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          roleKeys: [roleKey],
        }),
      },
    );

    const data = await response.json();
    const responseText = JSON.stringify(data).toLowerCase();
    const success =
      responseText.includes('already') ||
      responseText.includes('grantid');

    if (!success) {
      Logger.error(
        `Failed to assign role '${roleKey}' to user '${userId}' for project '${projectId}': ${JSON.stringify(data, null, 2)}`,
      );
      throw new Error('Failed to assign role to user');
    }
  }

  /**
   * Grant a user access to a project with specific roles (needed for token exchange)
   * @param {string} userId - User ID to grant access to
   * @param {string} projectId - Project ID
   * @param {string[]} roleKeys - Array of role keys to grant
   * @see https://zitadel.com/docs/reference/api/management/zitadel.management.v1.ManagementService.AddUserGrant
   */
  async grantUserProjectAccess(userId, projectId, roleKeys) {
    const response = await fetch(
      `${this.baseUrl}/management/v1/users/${userId}/grants`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          roleKeys,
        }),
      },
    );
    const data = await response.json();
    const responseText = JSON.stringify(data).toLowerCase();

    if (
      responseText.includes('grantid') ||
      responseText.includes('already')
    ) {
      return;
    }

    Logger.error(
      `Failed to grant user ${userId} access to project: ${JSON.stringify(data, null, 2)}`,
    );
    throw new Error('Granting user project access failed!');
  }

  /**
   * Create a Personal Access Token for a user
   * @param {string} userId - User ID
   * @see https://zitadel.com/docs/reference/api/management/zitadel.management.v1.ManagementService.AddPersonalAccessToken
   * @returns {Promise<string>} PAT token
   */
  async createUserPat(userId) {
    const response = await fetch(
      `${this.baseUrl}/management/v1/users/${userId}/pats`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expirationDate: '9999-12-31T23:59:59Z',
        }),
      },
    );
    const data = await response.json();

    if (!data.token) {
      Logger.error(
        `Failed to create PAT for user ${userId}: ${JSON.stringify(data, null, 2)}`,
      );
      throw new Error('Creating user PAT failed!');
    }

    return data.token;
  }

  /**
   * List all grants for a specific user
   * @param {string} userId - User ID
   * @see https://zitadel.com/docs/reference/api/management/zitadel.management.v1.ManagementService.ListUserGrants
   * @returns {Promise<Array<{projectId: string, roleKeys: string[]}>>} Array of grants
   */
  async listUserGrants(userId) {
    const response = await fetch(
      `${this.baseUrl}/management/v1/users/grants/_search`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          queries: [
            {
              userIdQuery: {
                userId,
              },
            },
          ],
        }),
      },
    );
    const data = await response.json();

    if (!response.ok) {
      Logger.error(
        `Failed to list grants for user ${userId}: ${JSON.stringify(data, null, 2)}`,
      );
      throw new Error('Listing user grants failed!');
    }

    return data.result || [];
  }

  /**
   * @summary Get the current login policy
   * @see https://zitadel.com/docs/reference/api/management/zitadel.management.v1.ManagementService.GetLoginPolicy
   */
  async fetchLoginPolicies() {
    // https://zitadel.com/docs/reference/api/management/zitadel.management.v1.ManagementService.GetLoginPolicy
    const getResponse = await fetch(
      `${this.baseUrl}/management/v1/policies/login`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );
    const currentPolicy = await getResponse.json();

    if (!getResponse.ok) {
      Logger.error(
        `Failed to get current login policy: ${JSON.stringify(currentPolicy, null, 2)}`,
      );
      throw new Error('Failed to get current login policy');
    }

    /** @type {LoginPolicy} */
    const policy = currentPolicy.policy ?? currentPolicy;

    return policy;
  }

  /**
   * Update the custom login policy
   * @param {CustomLoginPolicyBody} body
   * @returns {Promise<void>}
   * @see https://zitadel.com/docs/reference/api/management/zitadel.management.v1.ManagementService.UpdateCustomLoginPolicy
   */
  async updateLoginPolicies(body) {
    const response = await fetch(
      `${this.baseUrl}/management/v1/policies/login`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );
    const data = await response.json();

    if (!response.ok) {
      // Rerunning setup against an already-configured policy with identical values is a no-op, not a failure.
      if (data.message?.includes('LoginPolicy.NotChanged')) {
        return;
      }

      Logger.error(
        `Failed to update login policy: ${JSON.stringify(data, null, 2)}`,
      );
      throw new Error('Failed to update login policy');
    }
  }

  /**
   * Create a custom login policy
   * @param {CustomLoginPolicyBody} body
   * @see https://zitadel.com/docs/reference/api/management/zitadel.management.v1.ManagementService.AddCustomLoginPolicy
   */
  async createLoginPolicy(body) {
    const response = await fetch(
      `${this.baseUrl}/management/v1/policies/login`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );
    const data = await response.json();

    if (!response.ok) {
      // Setup can rerun against an already-provisioned instance (e.g. the
      // container restarted without being recreated); treat "already exists"
      // as success and update the existing policy instead.
      if (data.message?.includes('Login Policy already exists')) {
        await this.updateLoginPolicies(body);
        return;
      }

      Logger.error(
        `Failed to create custom login policy: ${JSON.stringify(data, null, 2)}`,
      );
      throw new Error('Failed to create custom login policy');
    }
  }

  /**
   * @returns {Promise<void>}
   */
  async enableSelfRegistration() {
    const policy = await this.fetchLoginPolicies();
    // Try to add a custom login policy with allowRegister enabled. If one already exists, update it instead.
    /** @type {CustomLoginPolicyBody} */
    const body = {
      allowUsernamePassword: policy.allowUsernamePassword ?? true,
      allowRegister: true,
      allowExternalIdp: policy.allowExternalIdp ?? false,
      forceMfa: policy.forceMfa ?? false,
      passwordlessType:
        policy.passwordlessType ?? 'PASSWORDLESS_TYPE_NOT_ALLOWED',
      hidePasswordReset: policy.hidePasswordReset ?? false,
      passwordCheckLifetime:
        policy.passwordCheckLifetime ?? '864000s',
      externalLoginCheckLifetime:
        policy.externalLoginCheckLifetime ?? '864000s',
      mfaInitSkipLifetime: policy.mfaInitSkipLifetime ?? '2592000s',
      secondFactorCheckLifetime:
        policy.secondFactorCheckLifetime ?? '64800s',
      multiFactorCheckLifetime:
        policy.multiFactorCheckLifetime ?? '43200s',
      allowDomainDiscovery: policy.allowDomainDiscovery ?? false,
      ignoreUnknownUsernames: policy.ignoreUnknownUsernames ?? false,
      disableLoginWithEmail: policy.disableLoginWithEmail ?? false,
      disableLoginWithPhone: policy.disableLoginWithPhone ?? false,
      forceMfaLocalOnly: policy.forceMfaLocalOnly ?? false,
    };

    // If the policy is already a custom one (isDefault === false), update it
    if (policy.isDefault === false) {
      await this.updateLoginPolicies(body);
      return;
    }

    await this.createLoginPolicy(body);
  }

  /**
   * Create a Zitadel Action (v1) — a server-side JavaScript snippet.
   *
   * @param {string} name - Action name
   * @param {string} script - JavaScript source code
   * @param {number} [timeout=5] - Execution timeout in seconds
   * @param {boolean} [allowedToFail=false] - Whether the action is allowed to fail without blocking the flow
   * @see https://zitadel.com/docs/reference/api/management/zitadel.management.v1.ManagementService.CreateAction
   * @returns {Promise<string>} Action ID
   */
  async createAction(
    name,
    script,
    timeout = 5,
    allowedToFail = false,
  ) {
    const response = await fetch(
      `${this.baseUrl}/management/v1/actions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          script,
          timeout: `${timeout}s`,
          allowedToFail,
        }),
      },
    );
    const data = await response.json();

    if (data.id) {
      return data.id;
    }

    // Check if action already exists
    if (JSON.stringify(data).toLowerCase().includes('already')) {
      return await this.#findActionByName(name);
    }

    Logger.error(
      `Failed to create action '${name}': ${JSON.stringify(data, null, 2)}`,
    );
    throw new Error(`Failed to create action '${name}'`);
  }

  /**
   * Set trigger actions for a specific flow type and trigger type.
   *
   * @param {'1' | '2' | '3' | '4'} flowType
   * Flow types:
   * - External Authentication: 1
   * - Complement Token: 2
   * - Internal Authentication: 3
   * - Complement SAML Response: 4
   * @param {'1' | '2' | '3' | '4' | '5' | '6'} triggerType
   * Trigger types depend on the flow type:
   * - External Authentication:
   *   - Post Authentication: 1
   *   - Pre Creation: 2
   *   - Post Creation: 3
   * - Internal Authentication:
   *   - Post Authentication: 1
   *   - Pre Creation: 2
   *   - Post Creation: 3
   * - Complement Token:
   *   - Pre Userinfo Creation: 4
   *   - Pre Access Token Creation: 5
   * - Complement SAML Response:
   *   - Pre SAML Response Creation: 6
   * @param {string[]} actionIds - Ordered list of action IDs to execute
   * @see https://zitadel.com/docs/reference/api/management/zitadel.management.v1.ManagementService.SetTriggerActions
   * @returns {Promise<void>}
   */
  async setTriggerActions(flowType, triggerType, actionIds) {
    const response = await fetch(
      `${this.baseUrl}/management/v1/flows/${flowType}/trigger/${triggerType}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          actionIds,
        }),
      },
    );
    const data = await response.json();

    if (!response.ok) {
      // Rerunning setup with the same action IDs already set is a no-op,
      // not a failure.
      if (data.message?.toLowerCase().includes('no changes')) {
        return;
      }

      Logger.error(
        `Failed to set trigger actions for flow ${flowType}, trigger ${triggerType}: ${JSON.stringify(data, null, 2)}`,
      );
      throw new Error('Failed to set trigger actions');
    }
  }

  /**
   * Find a project by name
   * @param {string} projectName - Project name
   * @see https://zitadel.com/docs/reference/api/management/zitadel.management.v1.ManagementService.ListProjects
   * @returns {Promise<string>} Project ID
   */
  async #findProjectByName(projectName) {
    const response = await fetch(
      `${this.baseUrl}/management/v1/projects/_search`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          queries: [
            {
              nameQuery: {
                name: projectName,
                method: 'TEXT_QUERY_METHOD_EQUALS',
              },
            },
          ],
        }),
      },
    );

    const data = await response.json();

    if (data.result?.[0]?.id) {
      return data.result[0].id;
    }

    Logger.error(
      `Failed to find project: ${JSON.stringify(data, null, 2)}`,
    );
    throw new Error(`Failed to find project`);
  }

  /**
   * Find an action by name
   * @param {string} actionName - Action name
   * @see https://zitadel.com/docs/reference/api/management/zitadel.management.v1.ManagementService.ListActions
   * @returns {Promise<string>} Action ID
   */
  async #findActionByName(actionName) {
    const response = await fetch(
      `${this.baseUrl}/management/v1/actions/_search`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          queries: [
            {
              actionNameQuery: {
                name: actionName,
                method: 'TEXT_QUERY_METHOD_EQUALS',
              },
            },
          ],
        }),
      },
    );

    const data = await response.json();

    if (data.result?.[0]?.id) {
      return data.result[0].id;
    }

    Logger.error(
      `Failed to find action '${actionName}': ${JSON.stringify(data, null, 2)}`,
    );
    throw new Error(`Failed to find action '${actionName}'`);
  }

  /**
   * Find an app by name within a project.
   *
   * Returns the full app object so callers can read `.id`,
   * `.oidcConfig.clientId`, or any other field they need.
   *
   * @param {string} projectId - Project ID
   * @param {string} appName - Application name
   * @see https://zitadel.com/docs/reference/api/management/zitadel.management.v1.ManagementService.ListApps
   * @returns {Promise<Record<string, any>>} App object
   */
  async #findApp(projectId, appName) {
    const response = await fetch(
      `${this.baseUrl}/management/v1/projects/${projectId}/apps/_search`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          queries: [
            {
              nameQuery: {
                name: appName,
                method: 'TEXT_QUERY_METHOD_EQUALS',
              },
            },
          ],
        }),
      },
    );
    const data = await response.json();
    const app = data.result?.[0];

    if (isEmpty(app)) {
      Logger.error(
        `Failed to find app '${appName}' in project: ${JSON.stringify(data, null, 2)}`,
      );
      throw new Error(`Failed to find app '${appName}'`);
    }

    return app;
  }
}

/**
 * @typedef {Object} PolicyDetails
 * @property {number} sequence
 * @property {string} creationDate ISO 8601 timestamp
 * @property {string} changeDate ISO 8601 timestamp
 * @property {string} resourceOwner
 *
 * @typedef {'PASSWORDLESS_TYPE_NOT_ALLOWED'} PasswordlessType
 *
 * @typedef {'SECOND_FACTOR_TYPE_UNSPECIFIED'} SecondFactorType
 *
 * @typedef {'MULTI_FACTOR_TYPE_UNSPECIFIED'} MultiFactorType
 *
 * @typedef {'IDP_TYPE_UNSPECIFIED'} IdpType
 *
 * @typedef {Object} IdentityProvider
 * @property {string} idpId
 * @property {string} idpName
 * @property {IdpType} idpType
 *
 * @typedef {Object} CustomLoginPolicyBody
 * @property {boolean} allowUsernamePassword
 * @property {boolean} allowRegister
 * @property {boolean} allowExternalIdp
 * @property {boolean} forceMfa
 * @property {PasswordlessType} passwordlessType
 * @property {boolean} hidePasswordReset
 * @property {string} passwordCheckLifetime
 * @property {string} externalLoginCheckLifetime
 * @property {string} mfaInitSkipLifetime
 * @property {string} secondFactorCheckLifetime
 * @property {string} multiFactorCheckLifetime
 * @property {boolean} allowDomainDiscovery
 * @property {boolean} ignoreUnknownUsernames
 * @property {boolean} disableLoginWithEmail
 * @property {boolean} disableLoginWithPhone
 * @property {boolean} forceMfaLocalOnly
 *
 * @typedef {Object} LoginPolicy
 * @property {PolicyDetails} details
 * @property {boolean} allowUsernamePassword
 * @property {boolean} allowRegister
 * @property {boolean} allowExternalIdp
 * @property {boolean} forceMfa
 * @property {PasswordlessType} passwordlessType
 * @property {boolean} isDefault
 * @property {boolean} hidePasswordReset
 * @property {boolean} ignoreUnknownUsernames
 * @property {string} defaultRedirectUri
 * @property {string} passwordCheckLifetime
 * @property {string} externalLoginCheckLifetime
 * @property {string} mfaInitSkipLifetime
 * @property {string} secondFactorCheckLifetime
 * @property {string} multiFactorCheckLifetime
 * @property {SecondFactorType[]} secondFactors
 * @property {MultiFactorType[]} multiFactors
 * @property {IdentityProvider[]} idps
 * @property {boolean} allowDomainDiscovery
 * @property {boolean} disableLoginWithEmail
 * @property {boolean} disableLoginWithPhone
 * @property {boolean} forceMfaLocalOnly
 */

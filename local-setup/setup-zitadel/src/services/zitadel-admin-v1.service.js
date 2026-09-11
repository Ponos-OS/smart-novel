// @ts-check

import { Logger } from '../utils/index.js';

/**
 * @typedef {'IAM_OWNER' | 'IAM_ORG_MANAGER' | 'IAM_END_USER_IMPERSONATOR'} InstanceMemberRole
 */

/**
 * Service for interacting with ZITADEL Admin V1 API endpoints
 */
export class ZitadelAdminV1Service {
  /**
   * @param {string} baseUrl - ZITADEL base URL
   * @param {string} accessToken - Bearer token for authentication
   */
  constructor(baseUrl, accessToken) {
    this.baseUrl = baseUrl;
    this.accessToken = accessToken;
  }

  /**
   * Update security policy to enable impersonation
   * @see https://zitadel.com/docs/reference/api/admin/zitadel.admin.v1.AdminService.SetSecurityPolicy
   * @returns {Promise<void>}
   */
  async enableImpersonationInSecurityPolicy() {
    /** @type {SecurityPolicyUpdate} */
    const body = {
      enableImpersonation: true,
    };
    const response = await fetch(
      `${this.baseUrl}/admin/v1/policies/security`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );
    const responseBody = await response.json();

    if (!response.ok) {
      // Rerunning setup with impersonation already enabled is a no-op, not a failure.
      if (
        responseBody.message?.toLowerCase().includes('no changes')
      ) {
        return;
      }

      Logger.error(
        `Failed to enable impersonation in security policy: ${JSON.stringify(responseBody, null, 2)}`,
      );
      throw new Error(
        `Failed to enable impersonation in security policy`,
      );
    }
  }

  /**
   * Add a user as an IAM instance member with the specified roles.
   * @param {string} userId - User ID
   * @param {InstanceMemberRole[]} roles - IAM roles to assign
   * @see https://could-not-find-it.com
   * @returns {Promise<void>}
   */
  async addInstanceMember(userId, roles) {
    const response = await fetch(`${this.baseUrl}/admin/v1/members`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, roles }),
    });
    const data = await response.json();
    const responseText = JSON.stringify(data).toLowerCase();
    const success =
      responseText.includes('already') ||
      responseText.includes('details') ||
      responseText.includes('userid');

    if (!success) {
      throw new Error(
        `Unexpected response when assigning roles [${roles.join(', ')}] to user (ID: ${userId}): ${JSON.stringify(data, null, 2)}`,
      );
    }
  }
}

/**
 * @typedef {Object} SecurityPolicyUpdate
 * @property {boolean} [enableImpersonation] - Allows users to impersonate other users. The impersonator needs the appropriate *_IMPERSONATOR roles assigned as well.
 * @property {boolean} [enableIframeEmbedding] - States if iframe embedding is enabled or disabled.
 * @property {string[]} [allowedOrigins] - Origins allowed loading ZITADEL in an iframe if enableIframeEmbedding is true.
 */

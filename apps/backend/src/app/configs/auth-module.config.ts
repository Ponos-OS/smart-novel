import { Inject } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import { readFile } from 'fs/promises';

import {
  type AuthModuleOptions,
  AuthModuleOptionsFactory,
} from '../../modules/auth/auth.module-definition';
import { appConfigs } from './app.config';

export class AuthModuleConfig implements AuthModuleOptionsFactory {
  constructor(
    @Inject(appConfigs.KEY)
    private readonly appConfig: ConfigType<typeof appConfigs>,
  ) {}

  async create(): Promise<AuthModuleOptions> {
    const clientId =
      this.appConfig.ZITADEL_CLIENT_ID ??
      (
        await readFile(this.appConfig.ZITADEL_CLIENT_ID_FILE!, {
          encoding: 'utf-8',
        })
      ).trim();
    const pat =
      this.appConfig.ZITADEL_PAT ??
      (
        await readFile(this.appConfig.ZITADEL_PAT_FILE!, {
          encoding: 'utf-8',
        })
      ).trim();

    if (!clientId) {
      throw new Error('ZITADEL client ID is required');
    }
    if (!pat) {
      throw new Error('ZITADEL personal access token is required');
    }

    return {
      issuerUrl: this.appConfig.ZITADEL_ISSUER_URL,
      issuerInternalUrl: this.appConfig.ZITADEL_INTERNAL_URL,
      clientId,
      pat,
      managementPat: this.appConfig.ZITADEL_MANAGEMENT_PAT,
      webhookSigningKey: this.appConfig.ZITADEL_WEBHOOK_SIGNING_KEY,
      projectId: this.appConfig.ZITADEL_PROJECT_ID,
      domain: this.appConfig.ZITADEL_DOMAIN,
      clientSecret: this.appConfig.ZITADEL_CLIENT_SECRET,
      callbackUrl: this.appConfig.ZITADEL_CALLBACK_URL,
      postLoginUrl: this.appConfig.ZITADEL_POST_LOGIN_URL ?? '/',
      postLogoutUrl: this.appConfig.ZITADEL_POST_LOGOUT_URL,
      sessionSecret: this.appConfig.SESSION_SECRET,
      sessionDuration: this.appConfig.SESSION_DURATION,
    };
  }
}

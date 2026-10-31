import {
  ConfigurableModuleBuilder,
  ConfigurableModuleOptionsFactory,
} from '@nestjs/common';
import { CommonModuleOptions } from 'nestjs-backend-common';

export type ExtraAuthModuleOptions = CommonModuleOptions;

export interface AuthModuleOptions {
  /**
   * @description OIDC issuer URL — the external/public URL used for JWT issuer validation (e.g. http://localhost:8080)
   */
  issuerUrl: string;
  /**
   * @description
   * Internal URL used to fetch OIDC discovery & JWKS when running in Docker.
   * Falls back to `issuerUrl` when not provided (e.g. outside of Docker).
   */
  issuerInternalUrl?: string;
  /**
   * @description OIDC client ID for the ZITADEL application.
   */
  clientId?: string;
  /**
   * @description Personal Access Token for the ZITADEL service account (machine user).
   * Used for admin API calls (e.g. user provisioning).
   */
  pat?: string;
  /**
   * @description Token of the machine user that may only manage user grants (`ORG_USER_PERMISSION_EDITOR`). Never the instance admin token.
   */
  managementPat: string;
  /**
   * @description ID of the ZITADEL project whose roles the application hands out.
   */
  projectId: string;
  /**
   * @description The base domain of your ZITADEL instance (e.g. https://zitadel.example.com)
   */
  domain: string;
  /**
   * @description The client secret for your OIDC application (optional for public clients)
   */
  clientSecret?: string;
  /**
   * @description The full URL where ZITADEL will redirect back after authentication
   */
  callbackUrl: string;
  /**
   * @description The URL to redirect after successful login (defaults to '/')
   */
  postLoginUrl?: string;
  /**
   * @description The URL to redirect after logout
   */
  postLogoutUrl: string;
  /**
   * @description Secret string used to sign the session cookie (min 32 characters)
   */
  sessionSecret: string;
  /**
   * @description Duration of the session in seconds
   */
  sessionDuration: number;
}

export type RegisterAuthModuleOptions = AuthModuleOptions &
  ExtraAuthModuleOptions;

export const MODULE_EXTRAS_TOKEN = 'AUTH_MODULE_EXTRAS_TOKEN';

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<AuthModuleOptions>()
  .setClassMethodName('register')
  .setExtras<ExtraAuthModuleOptions>(
    { global: false },
    (definition, extras) => ({
      ...definition,
      global: extras.global,
    }),
  )
  .setFactoryMethodName('create')
  .build();

export type AuthModuleOptionsFactory =
  ConfigurableModuleOptionsFactory<AuthModuleOptions, 'create'>;

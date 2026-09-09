import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import axios from 'axios';
import {
  createLocalJWKSet,
  errors as joseErrors,
  type JSONWebKeySet,
  jwtVerify,
  type JWTVerifyGetKey,
} from 'jose';
import {
  CustomLoggerService,
  retryAsync,
  urlBuilder,
} from 'nestjs-backend-common';

import { RedisService } from '../../redis';
import {
  type AuthModuleOptions,
  MODULE_OPTIONS_TOKEN,
} from '../auth.module-definition';
import { Role } from '../enums';
import {
  type IAuthProvider,
  IAuthUser,
  ZitadelJwtPayload,
  ZitadelOpenIdConfigurationResponse,
  ZitadelUserInfoResponse,
} from '../interfaces';
import { generateUserInfoCacheKey } from '../utils';

/**
 * @description
 * Validates JWT access tokens issued by ZITADEL, verified locally via the JWKS discovered from the OIDC well-known endpoint.
 *
 * Rich claims (email, roles, metadata, org) are fetched from the UserInfo endpoint and cached in Redis.
 *
 * To switch to another IdP, create a new class implementing `IAuthProvider` and swap `useClass` in `AuthModule`.
 */
@Injectable()
export class ZitadelAuthProvider
  implements IAuthProvider, OnModuleInit
{
  private jwks!: JWTVerifyGetKey;
  private jwksUri!: string;
  private userinfoEndpoint!: string;
  private issuer!: string;
  /** @description Cache TTL for userinfo responses (in seconds). */
  private static readonly USERINFO_CACHE_TTL_SECONDS = 60;

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions,
    private readonly logger: CustomLoggerService,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.discoverOidcConfig();
  }

  async validateToken(token: string): Promise<IAuthUser> {
    // Lazy-init if discovery failed at startup
    if (!this.jwks) {
      await this.discoverOidcConfig();
    }

    if (!this.jwks) {
      throw new Error(
        'OIDC provider is not available. Could not discover JWKS.',
      );
    }

    const { payload } = await jwtVerify<ZitadelJwtPayload>(
      token,
      this.jwks,
      {
        issuer: this.issuer,
      },
    );
    /**
     * @description
     * The Zitadel access-token JWT only contains basic claims (sub, aud, iss…). Rich claims (email, roles, metadata, org) are available via the standard OIDC UserInfo endpoint.
     */
    const userInfo = await this.fetchUserInfo(token);
    const user = this.normalizeUserInfo(payload.sub, userInfo);

    if (user.roles.length === 0) {
      user.roles = await this.fetchUserRoles(token);
    }

    return user;
  }

  async verifyIssuedByUs(token: string): Promise<void> {
    // Lazy-init if discovery failed at startup
    if (!this.jwks) {
      await this.discoverOidcConfig();
    }

    if (!this.jwks) {
      throw new Error(
        'OIDC provider is not available. Could not discover JWKS.',
      );
    }

    try {
      await jwtVerify(token, this.jwks, { issuer: this.issuer });
    } catch (error) {
      // JWTExpired is only thrown once the signature and issuer have already checked out, so it's the one failure we accept.
      if (error instanceof joseErrors.JWTExpired) {
        return;
      }

      throw error;
    }
  }

  /**
   * @description
   * Discover the OIDC configuration (issuer, JWKS URI) from the well-known endpoint.
   *
   * When an internal URL is configured (e.g. `http://traefik:80`), we must send `Host: <externalDomain>` so that Zitadel recognises the request (it only responds to its configured EXTERNALDOMAIN).
   */
  private async discoverOidcConfig(): Promise<void> {
    const internalBase =
      this.options.issuerInternalUrl ?? this.options.issuerUrl;
    const discoveryUrl = urlBuilder(
      internalBase,
      '.well-known',
      'openid-configuration',
    );

    try {
      const { data } =
        await axios.get<ZitadelOpenIdConfigurationResponse>(
          discoveryUrl,
        );
      /**
       * @description
       * When accessed via an internal URL the discovered issuer may omit the external port (e.g. "http://localhost" instead of "http://localhost:8080").  Always prefer the configured issuerUrl so that JWT verification matches the `iss` claim in tokens issued to end-users via the external URL.
       */
      this.issuer = this.options.issuerUrl;
      /** @description Rewrite the JWKS URI to use the internal base if needed */
      let jwksUri = data.jwks_uri;

      if (this.options.issuerInternalUrl) {
        const externalOrigin = new URL(this.options.issuerUrl).origin;
        const internalOrigin = new URL(internalBase).origin;

        jwksUri = jwksUri.replace(externalOrigin, internalOrigin);
      }

      /** @description Rewrite the userinfo endpoint to use the internal base if needed */
      let userinfoEndpoint = data.userinfo_endpoint;

      if (this.options.issuerInternalUrl) {
        const externalOrigin = new URL(this.options.issuerUrl).origin;
        const internalOrigin = new URL(internalBase).origin;

        userinfoEndpoint = userinfoEndpoint.replace(
          externalOrigin,
          internalOrigin,
        );
      }

      this.jwksUri = jwksUri;
      this.userinfoEndpoint = userinfoEndpoint;

      await this.refreshJwks();

      this.logger.debug(
        `OIDC discovery complete. Issuer: ${this.issuer}, JWKS: ${jwksUri}`,
      );
    } catch (error) {
      this.logger.warn(
        `OIDC discovery failed (will retry on first token validation): ${error}`,
      );
    }
  }

  /**
   * @description
   * Fetch the JSON Web Key Set from the JWKS URI using axios (which, unlike Node's built-in fetch, allows overriding the Host header) and build a local JWK set for token verification.
   */
  private async refreshJwks(): Promise<void> {
    const { data } = await axios.get<JSONWebKeySet>(this.jwksUri);

    this.jwks = createLocalJWKSet(data);
  }

  /**
   * @description
   * Retrieve the full set of claims (email, roles, metadata, org) from the OIDC UserInfo endpoint. Results are cached in Redis (keyed by a SHA-256 hash of the access token) for {@link USERINFO_CACHE_TTL_SECONDS} to avoid hitting the IdP on every GraphQL request.
   */
  private async fetchUserInfo(
    accessToken: string,
  ): Promise<ZitadelUserInfoResponse> {
    const cacheKey = generateUserInfoCacheKey(accessToken);

    try {
      const cached = await this.redisService.get(cacheKey);

      if (cached) {
        return JSON.parse(cached) as ZitadelUserInfoResponse;
      }
    } catch {
      // Redis read failure is non-fatal — fall through to the HTTP call.
    }

    const { data } = await axios.get<ZitadelUserInfoResponse>(
      this.userinfoEndpoint,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    await retryAsync(
      () =>
        this.redisService.set(
          cacheKey,
          JSON.stringify(data),
          ZitadelAuthProvider.USERINFO_CACHE_TTL_SECONDS,
        ),
      { retry: 0 },
    );

    return data;
  }

  /**
   * @description
   * Fallback for retrieving project roles when the UserInfo endpoint does not include them (e.g. when the token is a PAT — Personal Access Token).
   *
   * Calls the Zitadel **Auth API** (`POST /auth/v1/usergrants/me/_search`)
   * which works with any valid bearer token, including PATs.
   *
   * @see https://zitadel.com/docs/reference/api/auth/zitadel.auth.v1.AuthService.ListMyUserGrants
   */
  private async fetchUserRoles(accessToken: string): Promise<Role[]> {
    // Authorization v2beta (resource-based). Lists caller’s authorizations.
    // REST gateway path (HTTP/JSON) is available; exact path may vary by gateway version.
    // See v2 ListAuthorizations discussion reference.
    const url = urlBuilder(
      this.options.issuerInternalUrl ?? this.options.issuerUrl,
      'zitadel.authorization.v2beta.AuthorizationService',
      'ListAuthorizations',
    );

    try {
      const { data } = await axios.post(
        url,
        { pagination: { limit: 100, asc: true } },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            // In multi-org setups you may need: 'x-zitadel-orgid': '<org-id>'
          },
        },
      );

      const items = data.authorizations ?? data.result ?? [];
      const roles = new Set<Role>();

      for (const a of items) {
        const keys = a.roleKeys ?? a.roles ?? [];
        for (const k of keys) {
          roles.add(k as Role);
        }
      }
      return Array.from(roles);
    } catch {
      return [];
    }
  }

  /**
   * @description
   * Normalize ZITADEL UserInfo response into the provider-agnostic IAuthUser shape.
   */
  private normalizeUserInfo(
    sub: string,
    info: ZitadelUserInfoResponse,
  ): IAuthUser {
    const name = info.name ?? '';
    const preferredUsername = info.preferred_username ?? '';
    const email = info.email ?? '';
    const emailVerified = info.email_verified ?? false;
    const orgId = info['urn:zitadel:iam:org:id'] ?? undefined;
    const roles = this.getRoles(info);
    const rawMetadata = info['urn:zitadel:iam:user:metadata'] ?? {};
    const metadata: Record<string, string> = {};

    for (const [key, value] of Object.entries(rawMetadata)) {
      try {
        metadata[key] = Buffer.from(value, 'base64').toString(
          'utf-8',
        );
      } catch {
        metadata[key] = value;
      }
    }

    return {
      sub,
      name,
      preferredUsername,
      email,
      emailVerified,
      orgId,
      roles,
      metadata,
    };
  }

  private getRoles(info: ZitadelUserInfoResponse): Role[] {
    const rolesObj = info['urn:zitadel:iam:org:project:roles'] ?? {};

    return Object.keys(rolesObj) as Role[];
  }
}

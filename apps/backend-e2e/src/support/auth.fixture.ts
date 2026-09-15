import axios from 'axios';
import { importPKCS8, SignJWT } from 'jose';
import { createPrivateKey } from 'node:crypto';

import { config } from './config.helper';

export class AuthorizationFixture {
  static async getUserAuthorizationHeader() {
    const actorToken =
      await AuthorizationFixture.getActorAccessToken();
    const accessToken = await AuthorizationFixture.impersonate(
      actorToken,
      config.userIds.user,
    );

    return `Bearer ${accessToken}`;
  }

  static async getAdminAuthorizationHeader() {
    const actorToken =
      await AuthorizationFixture.getActorAccessToken();
    const accessToken = await AuthorizationFixture.impersonate(
      actorToken,
      config.userIds.admin,
    );

    return `Bearer ${accessToken}`;
  }

  static async getWriterAuthorizationHeader() {
    const actorToken =
      await AuthorizationFixture.getActorAccessToken();
    const accessToken = await AuthorizationFixture.impersonate(
      actorToken,
      config.userIds.writer,
    );

    return `Bearer ${accessToken}`;
  }

  static async getSecondWriterAuthorizationHeader() {
    const actorToken =
      await AuthorizationFixture.getActorAccessToken();
    const accessToken = await AuthorizationFixture.impersonate(
      actorToken,
      config.userIds.writer2,
    );

    return `Bearer ${accessToken}`;
  }

  private static async getActorAccessToken() {
    const { keyId, key, userId } =
      config.integrationTest.userBotKey.decodedKeyContent;

    // Convert RSA → PKCS8 for jose
    const privateKey = createPrivateKey({ key, format: 'pem' });
    const pkcs8Key = privateKey
      .export({ type: 'pkcs8', format: 'pem' })
      .toString();
    const pk = await importPKCS8(pkcs8Key, 'RS256');
    const now = Math.floor(Date.now() / 1000);

    const assertion = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: keyId })
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .setIssuer(userId)
      .setSubject(userId)
      .setAudience(config.zitadelIssuer)
      .sign(pk);

    const body = new URLSearchParams();

    body.set(
      'grant_type',
      'urn:ietf:params:oauth:grant-type:jwt-bearer',
    );
    body.set('assertion', assertion);
    body.set('client_id', config.integrationTest.clientId);
    body.set('client_secret', config.integrationTest.clientSecret);
    body.set('scope', config.integrationTest.scopes);

    const response = await axios.post(config.tokenEndpoint, body, {
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
    });

    return response.data.access_token;
  }

  private static async impersonate(
    actorToken: string,
    userId: string,
  ) {
    const body = new URLSearchParams();

    body.set(
      'grant_type',
      'urn:ietf:params:oauth:grant-type:token-exchange',
    );
    body.set('client_id', config.integrationTest.clientId);
    body.set('client_secret', config.integrationTest.clientSecret);
    body.set('actor_token', actorToken);
    body.set(
      'actor_token_type',
      'urn:ietf:params:oauth:token-type:access_token',
    );
    body.set(
      'subject_token_type',
      'urn:zitadel:params:oauth:token-type:user_id',
    );
    body.set('subject_token', userId);
    body.set(
      'requested_token_type',
      'urn:ietf:params:oauth:token-type:jwt',
    );
    body.set('scope', config.integrationTest.scopes);

    const response = await axios.post(config.tokenEndpoint, body, {
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
    });

    return response.data.access_token;
  }
}

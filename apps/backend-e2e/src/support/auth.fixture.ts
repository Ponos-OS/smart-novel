import axios from 'axios';
import { decodeJwt, importPKCS8, SignJWT } from 'jose';
import { createPrivateKey } from 'node:crypto';

import { config } from './config.helper';
import { uniquePenName } from './pen-name';
import { ZitadelFixture } from './zitadel.fixture';

interface AuthorizationOptions {
  /**
   * @description Create a new account instead of returning the seeded one, so the test starts from a clean state.
   */
  fresh?: boolean;
  /**
   * @description Only for a fresh writer: `false` leaves the platform terms unaccepted, for the specs that test the terms gate itself.
   */
  acceptTerms?: boolean;
}

export class AuthorizationFixture {
  static async getUserAuthorizationHeader({
    fresh,
  }: AuthorizationOptions = {}) {
    if (!fresh) {
      return AuthorizationFixture.getAuthorizationHeaderOf(
        config.userIds.user,
      );
    }

    return AuthorizationFixture.createAccount('user');
  }

  /**
   * @description An authenticated account that holds no role in the project, like one that signed in from outside smart-novel.
   */
  static async getNoRoleAuthorizationHeader() {
    const actorToken =
      await AuthorizationFixture.getActorAccessToken();
    const accessToken = await AuthorizationFixture.impersonate(
      actorToken,
      config.userIds.noRole,
    );

    return `Bearer ${accessToken}`;
  }

  static async getAdminAuthorizationHeader({
    fresh,
  }: AuthorizationOptions = {}) {
    if (!fresh) {
      return AuthorizationFixture.withAcceptedTerms(
        config.userIds.admin,
        await AuthorizationFixture.getAuthorizationHeaderOf(
          config.userIds.admin,
        ),
      );
    }

    const authorization =
      await AuthorizationFixture.createAccount('admin');

    return AuthorizationFixture.withAcceptedTerms(
      AuthorizationFixture.userIdOf(authorization),
      authorization,
    );
  }

  static async getWriterAuthorizationHeader({
    fresh,
    acceptTerms = true,
  }: AuthorizationOptions = {}) {
    if (!fresh) {
      return AuthorizationFixture.withAcceptedTerms(
        config.userIds.writer,
        await AuthorizationFixture.getAuthorizationHeaderOf(
          config.userIds.writer,
        ),
      );
    }

    const requester =
      await AuthorizationFixture.createAccount('user');
    const adminAuthorization =
      await AuthorizationFixture.getAdminAuthorizationHeader();
    const requestId = await AuthorizationFixture.graphql<{
      requestWriterAccess: { id: string };
    }>(
      `mutation ($note: String!, $penName: String!) {
        requestWriterAccess(note: $note, penName: $penName) { id }
      }`,
      {
        note: 'A fresh writer for an e2e test.',
        penName: uniquePenName(),
      },
      requester,
    ).then(({ requestWriterAccess }) => requestWriterAccess.id);

    await AuthorizationFixture.graphql(
      `mutation ($id: ID!) { approveWriter(id: $id) { id } }`,
      { id: requestId },
      adminAuthorization,
    );

    // The role is in the token, so the one from before the approval has to be replaced.
    const authorization =
      await AuthorizationFixture.refreshAuthorizationHeader(
        requester,
      );

    if (!acceptTerms) {
      return authorization;
    }

    return AuthorizationFixture.withAcceptedTerms(
      AuthorizationFixture.userIdOf(authorization),
      authorization,
    );
  }

  /**
   * @description A new token of the same account, for after its roles changed.
   */
  static refreshAuthorizationHeader(authorization: string) {
    return AuthorizationFixture.getAuthorizationHeaderOf(
      AuthorizationFixture.userIdOf(authorization),
    );
  }

  private static userIdOf(authorization: string) {
    return decodeJwt(authorization.replace('Bearer ', ''))
      .sub as string;
  }

  private static async createAccount(role: 'user' | 'admin') {
    const userId = await ZitadelFixture.createHumanUser();

    await ZitadelFixture.setProjectRole(userId, role);

    return AuthorizationFixture.getAuthorizationHeaderOf(userId);
  }

  private static async graphql<T>(
    query: string,
    variables: Record<string, unknown>,
    authorization: string,
  ): Promise<T> {
    const { data } = await axios.post(
      '/graphql',
      { query, variables },
      { headers: { Authorization: authorization } },
    );

    if (data.errors) {
      throw new Error(
        `Fixture request failed: ${JSON.stringify(data.errors)}`,
      );
    }

    return data.data;
  }

  private static async getAuthorizationHeaderOf(userId: string) {
    const actorToken =
      await AuthorizationFixture.getActorAccessToken();
    const accessToken = await AuthorizationFixture.impersonate(
      actorToken,
      userId,
    );

    return `Bearer ${accessToken}`;
  }

  private static readonly termsAcceptedBy = new Map<
    string,
    Promise<void>
  >();

  /**
   * @description Writers and admins cannot write before accepting the platform terms, so the fixture accepts them once per user.
   */
  private static async withAcceptedTerms(
    userId: string,
    authorization: string,
  ) {
    if (!AuthorizationFixture.termsAcceptedBy.has(userId)) {
      AuthorizationFixture.termsAcceptedBy.set(
        userId,
        AuthorizationFixture.acceptPlatformTerms(authorization),
      );
    }

    await AuthorizationFixture.termsAcceptedBy.get(userId);

    return authorization;
  }

  private static async acceptPlatformTerms(authorization: string) {
    const headers = { Authorization: authorization };
    const { data: terms } = await axios.post(
      '/graphql',
      { query: '{ platformTerms { version } }' },
      { headers },
    );
    const { data: accepted } = await axios.post(
      '/graphql',
      {
        query: `mutation ($version: Int!) {
          acceptPlatformTerms(version: $version) { accepted }
        }`,
        variables: { version: terms.data.platformTerms.version },
      },
      { headers },
    );

    if (!accepted.data?.acceptPlatformTerms.accepted) {
      throw new Error(
        `Could not accept the platform terms: ${JSON.stringify(accepted)}`,
      );
    }
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

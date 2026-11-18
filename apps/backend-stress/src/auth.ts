/**
 * @summary in short it help us to authenticate against ZITADEL
 */

import encoding from 'k6/encoding';
import http from 'k6/http';

import { send } from './client.ts';

interface ZitadelOutputs {
  project_id: { value: string };
  user_ids: { value: Record<'user' | 'writer', string> };
  integration_test: {
    value: {
      client_id: string;
      client_secret: string;
      bot_key: string;
    };
  };
}

const issuer =
  __ENV.ZITADEL_ISSUER_URL ?? 'http://auth.localhost:8080';
const tokenEndpoint = `${issuer}/oauth/v2/token`;

// open() only works while the script loads, not in setup().
export const zitadelOutputs: ZitadelOutputs = JSON.parse(
  open('/run/zitadel/outputs.json'),
);

// The bot key is PKCS#1 and Web Crypto only imports PKCS#8: wrap it in the PKCS#8 header of an RSA key.
function pkcs8(pem: string): ArrayBuffer {
  const body = pem.replace(/-----[A-Z ]+-----|\s/g, '');
  const pkcs1 = new Uint8Array(encoding.b64decode(body, 'std'));
  const total = pkcs1.length + 22;
  const header = [
    0x30,
    0x82,
    total >> 8,
    total & 0xff,
    0x02,
    0x01,
    0x00,
    0x30,
    0x0d,
    0x06,
    0x09,
    0x2a,
    0x86,
    0x48,
    0x86,
    0xf7,
    0x0d,
    0x01,
    0x01,
    0x01,
    0x05,
    0x00,
    0x04,
    0x82,
    pkcs1.length >> 8,
    pkcs1.length & 0xff,
  ];
  const wrapped = new Uint8Array(header.length + pkcs1.length);

  wrapped.set(header);
  wrapped.set(pkcs1, header.length);

  return wrapped.buffer;
}

function base64Url(value: string | ArrayBuffer): string {
  return encoding.b64encode(value, 'rawurl');
}

async function actorToken(outputs: ZitadelOutputs, scopes: string) {
  const { client_id, client_secret, bot_key } =
    outputs.integration_test.value;
  const { keyId, key, userId } = JSON.parse(bot_key);
  const signingKey = await crypto.subtle.importKey(
    'pkcs8',
    pkcs8(key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const now = Math.floor(Date.now() / 1000);
  const signingInput = `${base64Url(
    JSON.stringify({ alg: 'RS256', kid: keyId, typ: 'JWT' }),
  )}.${base64Url(
    JSON.stringify({
      iss: userId,
      sub: userId,
      aud: issuer,
      iat: now,
      exp: now + 60,
    }),
  )}`;
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    signingKey,
    new TextEncoder().encode(signingInput).buffer,
  );
  const response = http.post(tokenEndpoint, {
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: `${signingInput}.${base64Url(signature)}`,
    client_id,
    client_secret,
    scope: scopes,
  });

  if (response.status !== 200) {
    throw new Error(`actor token rejected: ${response.body}`);
  }

  return response.json('access_token') as string;
}

/**
 * @description An access token of a seeded user, got the way `backend-e2e` does: the bot of the integration test impersonates them.
 */
export async function tokensOf(
  outputs: ZitadelOutputs,
): Promise<{ writer: string; user: string }> {
  const { client_id, client_secret } = outputs.integration_test.value;
  const project = outputs.project_id.value;
  const scopes = `openid profile email urn:zitadel:iam:org:project:id:${project}:aud urn:zitadel:iam:org:project:id:${project}:roles urn:zitadel:iam:user:metadata`;
  const actor = await actorToken(outputs, scopes);

  const impersonate = (userId: string) => {
    const response = http.post(tokenEndpoint, {
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      client_id,
      client_secret,
      actor_token: actor,
      actor_token_type:
        'urn:ietf:params:oauth:token-type:access_token',
      subject_token: userId,
      subject_token_type:
        'urn:zitadel:params:oauth:token-type:user_id',
      requested_token_type: 'urn:ietf:params:oauth:token-type:jwt',
      scope: scopes,
    });

    if (response.status !== 200) {
      throw new Error(
        `token exchange for ${userId} rejected: ${response.body}`,
      );
    }

    return response.json('access_token') as string;
  };

  return {
    writer: impersonate(outputs.user_ids.value.writer),
    user: impersonate(outputs.user_ids.value.user),
  };
}

/**
 * @description Writers cannot write before accepting the platform terms.
 */
export function acceptPlatformTerms(token: string): void {
  const terms = send('PlatformTerms', {}, token);

  send(
    'AcceptPlatformTerms',
    { version: terms.data?.platformTerms.version },
    token,
  );
}

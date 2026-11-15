import axios from 'axios';
import { createHmac } from 'node:crypto';

import { ZitadelFixture } from '../support';

describe('ZITADEL events (e2e)', () => {
  const userAdded = '/zitadel-events/user-added';
  const event = JSON.stringify({ aggregateID: '399193312042418199' });

  function signedBy(key: string, body: string) {
    const timestamp = Math.floor(Date.now() / 1000);
    const hmac = createHmac('sha256', key)
      .update(`${timestamp}.${body}`)
      .digest('hex');

    return `t=${timestamp},v1=${hmac}`;
  }

  function post(body: string, signature?: string) {
    return axios.post(userAdded, body, {
      headers: {
        'Content-Type': 'application/json',
        ...(signature ? { 'ZITADEL-Signature': signature } : {}),
      },
      validateStatus: () => true,
    });
  }

  it('should give a user who registers the user role, without anybody calling the backend by hand', async () => {
    // Act
    const userId = await ZitadelFixture.createHumanUser();

    // Assert
    await expect
      .poll(
        async () =>
          (await ZitadelFixture.findGrant(userId))?.roleKeys,
        { timeout: 30_000 },
      )
      .toStrictEqual(['user']);
  }, 40_000);

  it('should refuse a call that is not signed', async () => {
    const response = await post(event);

    expect(response.status).toBe(401);
  });

  it('should refuse a call signed with another key', async () => {
    const response = await post(
      event,
      signedBy('whsec-not-the-key', event),
    );

    expect(response.status).toBe(401);
  });
});

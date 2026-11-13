import axios from 'axios';

import { AuthorizationFixture } from '../support';

describe('Auth (e2e)', () => {
  it.each([
    {
      role: 'user',
      getAuthorizationHeader:
        AuthorizationFixture.getUserAuthorizationHeader,
    },
    {
      role: 'admin',
      getAuthorizationHeader:
        AuthorizationFixture.getAdminAuthorizationHeader,
    },
    {
      role: 'writer',
      getAuthorizationHeader:
        AuthorizationFixture.getWriterAuthorizationHeader,
    },
  ])(
    'should allow $role to get user info',
    async ({ getAuthorizationHeader }) => {
      const { status, data } = await axios.post(
        '/graphql',
        {
          query: `#graphql
          query {
            whoAmI {
              sub
              name
              email
              emailVerified
              preferredUsername
              orgID
              roles
            }
          }
        `,
        },
        {
          headers: {
            Authorization: await getAuthorizationHeader(),
          },
        },
      );

      expect(status).toBe(200);
      expect(data.data.whoAmI.orgID).toBeNull();
      expect(data.data.whoAmI).toStrictEqual(
        expect.objectContaining({
          sub: expect.any(String),
          name: expect.any(String),
          email: expect.any(String),
          emailVerified: expect.any(Boolean),
          preferredUsername: expect.any(String),
          roles: expect.any(Array),
        }),
      );
    },
  );

  it('should reject unauthenticated requests to protected queries', async () => {
    const { data } = await axios.post('/graphql', {
      query: `#graphql
        query {
          whoAmI {
            sub
            email
          }
        }
      `,
    });

    // GraphQL returns 200 with errors array
    expect(data.errors).toBeDefined();
    expect(data.errors[0].message).toContain(
      'Missing Bearer token in Authorization header',
    );
  });
});

import axios from 'axios';

import { AuthorizationFixture } from '../support';

const REQUEST_WRITER_ACCESS = `#graphql
  mutation RequestWriterAccess($note: String!) {
    requestWriterAccess(note: $note) {
      id
      note
      status
      rejectionReason
      reviewedAt
    }
  }
`;

const MY_WRITER_REQUEST = `#graphql
  query MyWriterRequest {
    myWriterRequest {
      id
      note
      status
    }
  }
`;

async function graphql(
  query: string,
  variables: Record<string, unknown>,
  authorization?: string,
) {
  const { data } = await axios.post(
    '/graphql',
    { query, variables },
    {
      headers: authorization ? { Authorization: authorization } : {},
      validateStatus: () => true,
    },
  );

  return data;
}

describe('Writer requests (e2e)', () => {
  const note =
    'I have been writing serialized fantasy for six years.';
  let userAuthorization: string;

  beforeAll(async () => {
    userAuthorization =
      await AuthorizationFixture.getUserAuthorizationHeader();
  });

  it('should refuse a caller without a token', async () => {
    const data = await graphql(MY_WRITER_REQUEST, {});

    expect(data.errors).toBeDefined();
    expect(data.data?.myWriterRequest).toBeUndefined();
  });

  it.each([
    ['requestWriterAccess', REQUEST_WRITER_ACCESS, { note }],
    ['myWriterRequest', MY_WRITER_REQUEST, {}],
  ])(
    'should refuse %s to an account with no role',
    async (_operation, query, variables) => {
      const noRoleAuthorization =
        await AuthorizationFixture.getNoRoleAuthorizationHeader();

      const data = await graphql(
        query,
        variables,
        noRoleAuthorization,
      );

      expect(data.errors[0].extensions.code).toBe('FORBIDDEN');
      expect(data.errors[0].message).toContain('"user" role');
    },
  );

  it('should have no request for a user who never asked', async () => {
    const data = await graphql(
      MY_WRITER_REQUEST,
      {},
      userAuthorization,
    );

    expect(data.errors).toBeUndefined();
    expect(data.data.myWriterRequest).toBeNull();
  });

  it.each([
    ['empty', ''],
    ['whitespace-only', '   \n '],
    ['too long', 'a'.repeat(1001)],
  ])('should refuse a %s note', async (_name, invalidNote) => {
    const data = await graphql(
      REQUEST_WRITER_ACCESS,
      { note: invalidNote },
      userAuthorization,
    );

    expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
  });

  it('should let a user request, trim the note, and see the request', async () => {
    const data = await graphql(
      REQUEST_WRITER_ACCESS,
      { note: `  ${note}  ` },
      userAuthorization,
    );

    expect(data.errors).toBeUndefined();
    expect(data.data.requestWriterAccess).toMatchObject({
      note,
      status: 'PENDING',
      rejectionReason: null,
      reviewedAt: null,
    });

    const mine = await graphql(
      MY_WRITER_REQUEST,
      {},
      userAuthorization,
    );

    expect(mine.data.myWriterRequest).toMatchObject({
      id: data.data.requestWriterAccess.id,
      status: 'PENDING',
    });
  });

  it('should refuse a second request while one is pending', async () => {
    const data = await graphql(
      REQUEST_WRITER_ACCESS,
      { note },
      userAuthorization,
    );

    expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
    expect(data.errors[0].message).toContain('pending');
  });

  it.each([
    [
      'writer',
      () => AuthorizationFixture.getWriterAuthorizationHeader(),
    ],
    [
      'admin',
      () => AuthorizationFixture.getAdminAuthorizationHeader(),
    ],
  ])('should refuse a %s', async (_role, getAuthorization) => {
    const data = await graphql(
      REQUEST_WRITER_ACCESS,
      { note },
      await getAuthorization(),
    );

    expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
    expect(data.errors[0].message).toContain('writer access');
  });
});

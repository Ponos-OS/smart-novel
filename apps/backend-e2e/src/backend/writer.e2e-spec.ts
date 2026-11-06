import axios from 'axios';

import {
  AuthorizationFixture,
  ClusterFixture,
  uniquePenName,
} from '../support';

const REQUEST_WRITER_ACCESS = `#graphql
  mutation RequestWriterAccess($note: String!, $penName: String!) {
    requestWriterAccess(note: $note, penName: $penName) {
      id
      penName
      status
      applications {
        note
        appliedAt
        rejectionReason
        reviewedAt
      }
    }
  }
`;

const MY_WRITER = `#graphql
  query MyWriter {
    myWriter {
      id
      penName
      applications {
        note
      }
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
    const data = await graphql(MY_WRITER, {});

    expect(data.errors).toBeDefined();
    expect(data.data?.myWriter).toBeNull();
  });

  it.each([
    [
      'requestWriterAccess',
      REQUEST_WRITER_ACCESS,
      { note, penName: uniquePenName() },
    ],
    ['myWriter', MY_WRITER, {}],
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
    const data = await graphql(MY_WRITER, {}, userAuthorization);

    expect(data.errors).toBeUndefined();
    expect(data.data.myWriter).toBeNull();
  });

  it.each([
    ['empty', ''],
    ['whitespace-only', '   \n '],
    ['too long', 'a'.repeat(1001)],
  ])('should refuse a %s note', async (_name, invalidNote) => {
    const data = await graphql(
      REQUEST_WRITER_ACCESS,
      { note: invalidNote, penName: uniquePenName() },
      userAuthorization,
    );

    expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
  });

  it('should let a user request, trim the note and the pen name, and see the request', async () => {
    const penName = uniquePenName();

    const data = await graphql(
      REQUEST_WRITER_ACCESS,
      { note: `  ${note}  `, penName: `  ${penName}  ` },
      userAuthorization,
    );

    expect(data.errors).toBeUndefined();
    expect(data.data.requestWriterAccess).toMatchObject({
      penName,
      status: 'PENDING',
      applications: [
        {
          note,
          appliedAt: expect.any(String),
          rejectionReason: null,
          reviewedAt: null,
        },
      ],
    });

    const mine = await graphql(MY_WRITER, {}, userAuthorization);

    expect(mine.data.myWriter).toMatchObject({
      id: data.data.requestWriterAccess.id,
      penName,
      status: 'PENDING',
    });
  });

  it('should refuse a second request while one is pending', async () => {
    const data = await graphql(
      REQUEST_WRITER_ACCESS,
      { note, penName: uniquePenName() },
      userAuthorization,
    );

    expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
    expect(data.errors[0].message).toContain('pending');
  });

  it.each([
    ['too short', 'ab'],
    ['too long', 'a'.repeat(51)],
    ['with a digit', 'Mina2'],
    ['with a space', 'Mina Ardalan'],
    ['with another alphabet', 'Мина_Ардалан'],
    ['with a dot', 'Mina.Ardalan'],
  ])('should refuse a pen name %s', async (_name, penName) => {
    const data = await graphql(
      REQUEST_WRITER_ACCESS,
      { note, penName },
      userAuthorization,
    );

    expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
  });

  describe('a pen name another writer already has', () => {
    const holderUserId = '111111111111111111';
    const taken = 'Taken_Name_Holder';

    beforeAll(() => {
      ClusterFixture.queryDatabase(
        `INSERT INTO writers (id, user_id, name, email, pen_name, status, applications)
         VALUES (gen_random_uuid(), '${holderUserId}', 'Pen Holder', 'holder@example.com', '${taken}', 'APPROVED', '[]')
         ON CONFLICT DO NOTHING;`,
      );
    });

    afterAll(() => {
      ClusterFixture.queryDatabase(
        `DELETE FROM writers WHERE user_id = '${holderUserId}';`,
      );
    });

    it.each([taken, taken.toUpperCase(), taken.toLowerCase()])(
      'should answer PEN_NAME_TAKEN for %s, whatever its case',
      async (penName) => {
        const data = await graphql(
          REQUEST_WRITER_ACCESS,
          { note, penName },
          userAuthorization,
        );

        expect(data.errors[0].extensions).toMatchObject({
          code: 'PEN_NAME_TAKEN',
          status: 409,
        });
        expect(data.errors[0].message).toContain('already taken');
      },
    );
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
      { note, penName: uniquePenName() },
      await getAuthorization(),
    );

    expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
    expect(data.errors[0].message).toContain('writer access');
  });
});

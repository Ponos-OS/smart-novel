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
      await AuthorizationFixture.getUserAuthorizationHeader({
        fresh: true,
      });
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

  describe('a pen name that breaks the rule', () => {
    const onlyLetters =
      'A pen name can only have English letters, hyphens and underscores';
    it.each([
      ['  ', 'Choose a pen name'],
      ['ab', 'A pen name needs at least 3 characters'],
      ['a'.repeat(51), 'A pen name can have at most 50 characters'],
      ['Mina2', onlyLetters],
      ['Mina Ardalan', onlyLetters],
      ['M\u00edna', onlyLetters],
    ])('should answer %j with "%s"', async (penName, message) => {
      const requester =
        await AuthorizationFixture.getUserAuthorizationHeader({
          fresh: true,
        });

      const data = await graphql(
        REQUEST_WRITER_ACCESS,
        { note, penName },
        requester,
      );

      expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
      expect(data.errors[0].message).toBe(message);
    });

    it('should refuse a pen name with a NUL character', async () => {
      const requester =
        await AuthorizationFixture.getUserAuthorizationHeader({
          fresh: true,
        });

      const data = await graphql(
        REQUEST_WRITER_ACCESS,
        { note, penName: 'Mina\u0000' },
        requester,
      );

      expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
    });
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

        expect(data.errors[0].extensions.code).toBe('PEN_NAME_TAKEN');
        expect(data.errors[0].message).toContain('already taken');
      },
    );
  });
});

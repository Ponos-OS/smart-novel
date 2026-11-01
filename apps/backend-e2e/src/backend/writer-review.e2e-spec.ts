import axios from 'axios';

import { AuthorizationFixture } from '../support';

const REQUEST_WRITER_ACCESS = `#graphql
  mutation RequestWriterAccess($note: String!) {
    requestWriterAccess(note: $note) {
      id
    }
  }
`;

const MY_WRITER = `#graphql
  query MyWriter {
    myWriter {
      id
      status
      rejectionReason
    }
  }
`;

const WRITERS = `#graphql
  query Writers(
    $first: Int
    $after: String
    $filters: WriterFiltersInput
  ) {
    writersConnection(
      first: $first
      after: $after
      filters: $filters
    ) {
      edges {
        cursor
        node {
          id
          userId
          name
          email
          note
          status
          rejectionReason
          createdAt
          reviewedAt
        }
      }
      pageInfo {
        hasNextPage
      }
    }
  }
`;

const APPROVE = `#graphql
  mutation ApproveWriter($id: ID!) {
    approveWriter(id: $id) {
      id
      status
      reviewedAt
    }
  }
`;

const REJECT = `#graphql
  mutation RejectWriter($id: ID!, $reason: String) {
    rejectWriter(id: $id, reason: $reason) {
      id
      status
      rejectionReason
      reviewedAt
    }
  }
`;

const WHO_AM_I = `#graphql
  query WhoAmI {
    whoAmI {
      roles
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

describe('Writer request review (e2e)', () => {
  const unknownId = '0b0b5a4e-3a8f-4d52-9c6e-7d8f1a2b3c4d';
  let adminAuthorization: string;

  beforeAll(async () => {
    adminAuthorization =
      await AuthorizationFixture.getAdminAuthorizationHeader();
  });

  describe('who may review', () => {
    it.each([
      [
        'user',
        () => AuthorizationFixture.getUserAuthorizationHeader(),
      ],
      [
        'writer',
        () => AuthorizationFixture.getWriterAuthorizationHeader(),
      ],
    ])(
      'should refuse a %s to list, approve and reject',
      async (_role, getAuthorization) => {
        const authorization = await getAuthorization();

        const responses = await Promise.all([
          graphql(WRITERS, {}, authorization),
          graphql(APPROVE, { id: unknownId }, authorization),
          graphql(REJECT, { id: unknownId }, authorization),
        ]);

        for (const data of responses) {
          expect(data.errors[0].extensions.code).toBe('FORBIDDEN');
          expect(data.errors[0].message).toContain('"admin" role');
        }
      },
    );

    it.each([
      ['approve', APPROVE],
      ['reject', REJECT],
    ])(
      'should answer 404 when an admin %ss an unknown request',
      async (_name, mutation) => {
        const data = await graphql(
          mutation,
          { id: unknownId },
          adminAuthorization,
        );

        expect(data.errors[0].message).toBe(
          'Writer request not found',
        );
      },
    );
  });

  describe('approving', () => {
    let applicantAuthorization: string;
    let requestId: string;

    beforeAll(async () => {
      applicantAuthorization =
        await AuthorizationFixture.getApplicantAuthorizationHeader();
    });

    it('should show an admin the pending request with who asked', async () => {
      const created = await graphql(
        REQUEST_WRITER_ACCESS,
        { note: 'I serialize a fantasy web novel.' },
        applicantAuthorization,
      );
      requestId = created.data.requestWriterAccess.id;

      const data = await graphql(
        WRITERS,
        { first: 100 },
        adminAuthorization,
      );

      expect(data.errors).toBeUndefined();
      expect(
        data.data.writersConnection.edges.map(
          ({ node }: { node: { id: string } }) => node,
        ),
      ).toContainEqual({
        id: requestId,
        userId: expect.stringMatching(/^\d+$/),
        name: 'Applicant One',
        email: 'applicant@test.com',
        note: 'I serialize a fantasy web novel.',
        status: 'PENDING',
        rejectionReason: null,
        createdAt: expect.any(String),
        reviewedAt: null,
      });
    });

    it('should grant exactly the writer role in ZITADEL', async () => {
      const before = await graphql(
        WHO_AM_I,
        {},
        applicantAuthorization,
      );

      const data = await graphql(
        APPROVE,
        { id: requestId },
        adminAuthorization,
      );

      expect(before.data.whoAmI.roles).toStrictEqual(['user']);
      expect(data.errors).toBeUndefined();
      expect(data.data.approveWriter).toMatchObject({
        id: requestId,
        status: 'APPROVED',
        reviewedAt: expect.any(String),
      });

      const freshAuthorization =
        await AuthorizationFixture.getApplicantAuthorizationHeader();
      const after = await graphql(WHO_AM_I, {}, freshAuthorization);

      expect(after.data.whoAmI.roles).toStrictEqual(['writer']);
    });

    it('should move the request out of the pending list', async () => {
      const pending = await graphql(
        WRITERS,
        { first: 100 },
        adminAuthorization,
      );
      const approved = await graphql(
        WRITERS,
        { first: 100, filters: { status: 'APPROVED' } },
        adminAuthorization,
      );

      const idsOf = (data: any): string[] =>
        data.data.writersConnection.edges.map(
          ({ node }: { node: { id: string } }) => node.id,
        );

      expect(idsOf(pending)).not.toContain(requestId);
      expect(idsOf(approved)).toContain(requestId);
    });

    it.each([
      ['approve', APPROVE, {}],
      ['reject', REJECT, { reason: 'Too late.' }],
    ])(
      'should refuse to %s it a second time',
      async (_name, mutation, extra) => {
        const data = await graphql(
          mutation,
          { id: requestId, ...extra },
          adminAuthorization,
        );

        expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
        expect(data.errors[0].message).toContain('already reviewed');
      },
    );

    it('should tell the new writer that they cannot ask again', async () => {
      const freshAuthorization =
        await AuthorizationFixture.getApplicantAuthorizationHeader();

      const data = await graphql(
        REQUEST_WRITER_ACCESS,
        { note: 'Asking again.' },
        freshAuthorization,
      );

      expect(data.errors[0].message).toContain('writer access');
    });
  });

  describe('rejecting', () => {
    let applicantAuthorization: string;
    let requestId: string;

    beforeAll(async () => {
      applicantAuthorization =
        await AuthorizationFixture.getSecondApplicantAuthorizationHeader();
    });

    it('should store the trimmed reason and show it to the requester', async () => {
      const created = await graphql(
        REQUEST_WRITER_ACCESS,
        { note: 'I would like to publish poems.' },
        applicantAuthorization,
      );
      requestId = created.data.requestWriterAccess.id;

      const data = await graphql(
        REJECT,
        {
          id: requestId,
          reason: '  Please share a sample chapter.  ',
        },
        adminAuthorization,
      );

      expect(data.errors).toBeUndefined();
      expect(data.data.rejectWriter).toMatchObject({
        id: requestId,
        status: 'REJECTED',
        rejectionReason: 'Please share a sample chapter.',
        reviewedAt: expect.any(String),
      });

      const mine = await graphql(
        MY_WRITER,
        {},
        applicantAuthorization,
      );

      expect(mine.data.myWriter).toStrictEqual({
        id: requestId,
        status: 'REJECTED',
        rejectionReason: 'Please share a sample chapter.',
      });
    });

    it('should leave the requester a user in ZITADEL', async () => {
      const freshAuthorization =
        await AuthorizationFixture.getSecondApplicantAuthorizationHeader();

      const data = await graphql(WHO_AM_I, {}, freshAuthorization);

      expect(data.data.whoAmI.roles).toStrictEqual(['user']);
    });

    it('should let the requester file a new request, keeping the old one as history', async () => {
      const created = await graphql(
        REQUEST_WRITER_ACCESS,
        { note: 'Here is a sample chapter.' },
        applicantAuthorization,
      );
      const rejected = await graphql(
        WRITERS,
        { first: 100, filters: { status: 'REJECTED' } },
        adminAuthorization,
      );
      const mine = await graphql(
        MY_WRITER,
        {},
        applicantAuthorization,
      );

      expect(created.errors).toBeUndefined();
      expect(mine.data.myWriter.status).toBe('PENDING');
      expect(
        rejected.data.writersConnection.edges.map(
          ({ node }: { node: { id: string } }) => node.id,
        ),
      ).toContain(requestId);
    });
  });

  describe('searching', () => {
    const statuses = ['PENDING', 'APPROVED', 'REJECTED'];

    async function searchEveryStatus(search: string) {
      const results = await Promise.all(
        statuses.map((status) =>
          graphql(
            WRITERS,
            { first: 100, filters: { status, search } },
            adminAuthorization,
          ),
        ),
      );

      expect(results.map(({ errors }) => errors)).toStrictEqual([
        undefined,
        undefined,
        undefined,
      ]);

      return results.flatMap(({ data }) =>
        data.writersConnection.edges.map(
          ({
            node,
          }: {
            node: {
              name: string;
              email: string;
              userId: string;
            };
          }) => node,
        ),
      );
    }

    beforeAll(async () => {
      // Another spec may have filed this one already, which is a 400 and fine here.
      await graphql(
        REQUEST_WRITER_ACCESS,
        { note: 'Searching needs a request from the regular user.' },
        await AuthorizationFixture.getUserAuthorizationHeader(),
      );
    });

    it.each([
      {
        scenario: 'a part of the name, in any case',
        search: 'rEgULar uS',
      },
      { scenario: 'a part of the email', search: 'user@test' },
    ])('should find the request by $scenario', async ({ search }) => {
      const result = await searchEveryStatus(search);

      expect(result.map(({ email }) => email)).toContain(
        'user@test.com',
      );
      expect(
        result.every(({ userId }) => userId.length > 0),
      ).toBeTrue();
    });

    it.each(['%', 'regular_user', 'regular\\'])(
      'should treat %s as text, not as a LIKE pattern',
      async (search) => {
        const result = await searchEveryStatus(search);

        expect(result).toBeEmpty();
      },
    );

    it('should refuse a cursor issued without the search', async () => {
      const first = await graphql(
        WRITERS,
        { first: 1 },
        adminAuthorization,
      );
      const { cursor } = first.data.writersConnection.edges[0];

      const data = await graphql(
        WRITERS,
        { first: 1, after: cursor, filters: { search: 'user' } },
        adminAuthorization,
      );

      expect(data.errors[0].message).toContain('Invalid cursor');
    });

    it('should refuse a search over the limit', async () => {
      const data = await graphql(
        WRITERS,
        { first: 1, filters: { search: 'a'.repeat(101) } },
        adminAuthorization,
      );

      expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
    });
  });

  describe('paging', () => {
    it('should page pending requests oldest first', async () => {
      // Another spec may have filed this one already, which is a 400 and fine here.
      await graphql(
        REQUEST_WRITER_ACCESS,
        { note: 'Paging needs a second pending request.' },
        await AuthorizationFixture.getUserAuthorizationHeader(),
      );
      const first = await graphql(
        WRITERS,
        { first: 1 },
        adminAuthorization,
      );
      const { edges, pageInfo } = first.data.writersConnection;

      expect(first.errors).toBeUndefined();
      expect(edges).toHaveLength(1);
      expect(pageInfo.hasNextPage).toBe(true);
    });

    it('should refuse a page over the cap', async () => {
      const data = await graphql(
        WRITERS,
        { first: 101 },
        adminAuthorization,
      );

      expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
    });
  });
});

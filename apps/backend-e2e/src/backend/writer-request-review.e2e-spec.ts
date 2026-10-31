import axios from 'axios';

import { AuthorizationFixture } from '../support';

const REQUEST_WRITER_ACCESS = `#graphql
  mutation RequestWriterAccess($note: String!) {
    requestWriterAccess(note: $note) {
      id
    }
  }
`;

const MY_WRITER_REQUEST = `#graphql
  query MyWriterRequest {
    myWriterRequest {
      id
      status
      rejectionReason
    }
  }
`;

const WRITER_REQUESTS = `#graphql
  query WriterRequests($first: Int, $filters: WriterRequestFiltersInput) {
    writerRequestsConnection(first: $first, filters: $filters) {
      edges {
        cursor
        node {
          id
          requesterName
          requesterEmail
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
  mutation ApproveWriterRequest($id: ID!) {
    approveWriterRequest(id: $id) {
      id
      status
      reviewedAt
    }
  }
`;

const REJECT = `#graphql
  mutation RejectWriterRequest($id: ID!, $reason: String) {
    rejectWriterRequest(id: $id, reason: $reason) {
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
          graphql(WRITER_REQUESTS, {}, authorization),
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
        WRITER_REQUESTS,
        { first: 100 },
        adminAuthorization,
      );

      expect(data.errors).toBeUndefined();
      expect(
        data.data.writerRequestsConnection.edges.map(
          ({ node }: { node: { id: string } }) => node,
        ),
      ).toContainEqual({
        id: requestId,
        requesterName: 'Applicant One',
        requesterEmail: 'applicant@test.com',
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
      expect(data.data.approveWriterRequest).toMatchObject({
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
        WRITER_REQUESTS,
        { first: 100 },
        adminAuthorization,
      );
      const approved = await graphql(
        WRITER_REQUESTS,
        { first: 100, filters: { status: 'APPROVED' } },
        adminAuthorization,
      );

      const idsOf = (data: any): string[] =>
        data.data.writerRequestsConnection.edges.map(
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
      expect(data.data.rejectWriterRequest).toMatchObject({
        id: requestId,
        status: 'REJECTED',
        rejectionReason: 'Please share a sample chapter.',
        reviewedAt: expect.any(String),
      });

      const mine = await graphql(
        MY_WRITER_REQUEST,
        {},
        applicantAuthorization,
      );

      expect(mine.data.myWriterRequest).toStrictEqual({
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
        WRITER_REQUESTS,
        { first: 100, filters: { status: 'REJECTED' } },
        adminAuthorization,
      );
      const mine = await graphql(
        MY_WRITER_REQUEST,
        {},
        applicantAuthorization,
      );

      expect(created.errors).toBeUndefined();
      expect(mine.data.myWriterRequest.status).toBe('PENDING');
      expect(
        rejected.data.writerRequestsConnection.edges.map(
          ({ node }: { node: { id: string } }) => node.id,
        ),
      ).toContain(requestId);
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
        WRITER_REQUESTS,
        { first: 1 },
        adminAuthorization,
      );
      const { edges, pageInfo } = first.data.writerRequestsConnection;

      expect(first.errors).toBeUndefined();
      expect(edges).toHaveLength(1);
      expect(pageInfo.hasNextPage).toBe(true);
    });

    it('should refuse a page over the cap', async () => {
      const data = await graphql(
        WRITER_REQUESTS,
        { first: 101 },
        adminAuthorization,
      );

      expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
    });
  });
});

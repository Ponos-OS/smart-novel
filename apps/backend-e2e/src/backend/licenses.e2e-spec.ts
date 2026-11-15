import axios from 'axios';
import { randomUUID } from 'node:crypto';

import { AuthorizationFixture } from '../support';

const LICENSES_CONNECTION = `#graphql
  query Licenses(
    $first: Int
    $last: Int
    $after: Cursor
    $scope: LicenseScope
    $search: String
  ) {
    licenses(
      first: $first
      last: $last
      after: $after
      scope: $scope
      search: $search
    ) {
      edges {
        cursor
        node {
          id
          name
          scope
          isDefault
          ownerID
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

const CREATE_LICENSE_DRAFT = `#graphql
  mutation CreateLicenseDraft($input: CreateLicenseDraftInput!) {
    createLicenseDraft(input: $input) {
      id
    }
  }
`;

const SAVE_LICENSE_DRAFT = `#graphql
  mutation SaveLicenseDraft($input: SaveLicenseDraftInput!) {
    saveLicenseDraft(input: $input) {
      id
    }
  }
`;

const FINALIZE_LICENSE_DRAFT = `#graphql
  mutation FinalizeLicenseDraft($id: ID!) {
    finalizeLicenseDraft(id: $id) {
      id
    }
  }
`;

async function graphql(
  query: string,
  variables: Record<string, unknown>,
  authorization: string,
) {
  const { data } = await axios.post(
    '/graphql',
    { query, variables },
    {
      headers: { Authorization: authorization },
      validateStatus: () => true,
    },
  );

  return data;
}

describe('licenses (e2e)', () => {
  let admin: string;
  let writer: string;
  let otherWriter: string;
  let writerLicenseId: string;
  let writerDraftId: string;
  let otherWriterLicenseId: string;
  let otherWriterDraftId: string;

  async function list(
    variables: Record<string, unknown>,
    authorization: string,
  ) {
    const data = await graphql(
      LICENSES_CONNECTION,
      variables,
      authorization,
    );

    return data.data.licenses;
  }

  async function createPersonalLicense(authorization: string) {
    const draftId = await createDraft(authorization);
    await graphql(
      SAVE_LICENSE_DRAFT,
      {
        input: {
          id: draftId,
          name: 'Read it, do not copy it',
          text: `You may read this novel. ${randomUUID()}`,
          sourceType: 'CUSTOM',
        },
      },
      authorization,
    );
    const data = await graphql(
      FINALIZE_LICENSE_DRAFT,
      { id: draftId },
      authorization,
    );

    return data.data.finalizeLicenseDraft.id as string;
  }

  async function createDraft(authorization: string) {
    const data = await graphql(
      CREATE_LICENSE_DRAFT,
      {
        input: {},
      },
      authorization,
    );

    return data.data.createLicenseDraft.id as string;
  }

  beforeAll(async () => {
    admin = await AuthorizationFixture.getAdminAuthorizationHeader();
    writer = await AuthorizationFixture.getWriterAuthorizationHeader({
      fresh: true,
    });
    otherWriter =
      await AuthorizationFixture.getWriterAuthorizationHeader({
        fresh: true,
      });
    writerLicenseId = await createPersonalLicense(writer);
    writerDraftId = await createDraft(writer);
    otherWriterLicenseId = await createPersonalLicense(otherWriter);
    otherWriterDraftId = await createDraft(otherWriter);
  });

  it('should list every scope of license for an admin', async () => {
    const result = await list({ first: 100 }, admin);

    const ids = result.edges.map(({ node }: any) => node.id);
    expect(ids).toIncludeAllMembers([
      writerLicenseId,
      writerDraftId,
      otherWriterLicenseId,
      otherWriterDraftId,
    ]);
  });

  it('should flag exactly one license as the default', async () => {
    const result = await list({ first: 100, scope: 'SHARED' }, admin);

    const defaults = result.edges.filter(
      ({ node }: any) => node.isDefault,
    );
    expect(defaults).toHaveLength(1);
    expect(defaults[0].node).toMatchObject({
      name: 'CC BY 4.0',
      scope: 'SHARED',
      ownerID: 'system',
    });
  });

  it("should give a writer the shared licenses and their own, never another writer's", async () => {
    const result = await list({ first: 100 }, writer);

    const ids = result.edges.map(({ node }: any) => node.id);
    expect(ids).toIncludeAllMembers([writerLicenseId, writerDraftId]);
    expect(ids).not.toContainAnyValues([
      otherWriterLicenseId,
      otherWriterDraftId,
    ]);
    expect(
      result.edges.every(
        ({ node }: any) =>
          node.ownerID === 'system' ||
          node.id === writerLicenseId ||
          node.id === writerDraftId ||
          node.scope !== 'SHARED',
      ),
    ).toBeTrue();
  });

  it.each([
    ['SHARED', 'system'],
    ['PERSONAL', undefined],
    ['DRAFT', undefined],
  ])('should narrow to the %s scope', async (scope, ownerID) => {
    const result = await list({ first: 100, scope }, admin);

    expect(result.edges).not.toBeEmpty();
    for (const { node } of result.edges) {
      expect(node.scope).toBe(scope);
      if (ownerID) {
        expect(node.ownerID).toBe(ownerID);
      }
    }
  });

  it('should find a license by part of its name, ignoring case', async () => {
    const result = await list(
      { first: 100, search: 'cc BY' },
      writer,
    );

    expect(result.edges).not.toBeEmpty();
    for (const { node } of result.edges) {
      expect(node.name.toLowerCase()).toContain('cc by');
    }
  });

  it('should page through the licenses without repeating one', async () => {
    const first = await list({ first: 1 }, admin);
    const second = await list(
      { first: 1, after: first.pageInfo.endCursor },
      admin,
    );

    expect(first.pageInfo.hasNextPage).toBeTrue();
    expect(second.edges[0].node.id).not.toBe(first.edges[0].node.id);
  });

  it('should refuse a page larger than the maximum', async () => {
    const data = await graphql(
      LICENSES_CONNECTION,
      { first: 101 },
      admin,
    );

    expect(data.errors).toBeDefined();
  });

  it('should refuse a plain user', async () => {
    const user =
      await AuthorizationFixture.getUserAuthorizationHeader();

    const data = await graphql(
      LICENSES_CONNECTION,
      { first: 10 },
      user,
    );

    expect(data.errors).toBeDefined();
    expect(data.data).toBeNull();
  });
});

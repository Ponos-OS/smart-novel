import axios from 'axios';
import { randomUUID } from 'node:crypto';

import { AuthorizationFixture } from '../support';

const DRAFT_FIELDS = `
  id
  ownerId
  title
  text
  source {
    type
    canonicalId
  }
  updatedAt
`;

const CREATE_LICENSE_DRAFT = `#graphql
  mutation CreateLicenseDraft($input: CreateLicenseDraftInput!) {
    createLicenseDraft(input: $input) {
      ${DRAFT_FIELDS}
    }
  }
`;

const SAVE_LICENSE_DRAFT = `#graphql
  mutation SaveLicenseDraft($input: SaveLicenseDraftInput!) {
    saveLicenseDraft(input: $input) {
      ${DRAFT_FIELDS}
    }
  }
`;

const FINALIZE_LICENSE_DRAFT = `#graphql
  mutation FinalizeLicenseDraft($id: ID!) {
    finalizeLicenseDraft(id: $id) {
      id
      name
      text
      sourceType
    }
  }
`;

const DISCARD_LICENSE_DRAFT = `#graphql
  mutation DiscardLicenseDraft($id: ID!) {
    discardLicenseDraft(id: $id)
  }
`;

const LICENSE_DRAFTS_CONNECTION = `#graphql
  query LicenseDraftsConnection(
    $first: Int
    $after: String
    $filters: LicenseDraftFiltersInput
  ) {
    licenseDraftsConnection(first: $first, after: $after, filters: $filters) {
      edges {
        cursor
        node {
          id
          ownerId
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

const LICENSE_DRAFT = `#graphql
  query LicenseDraft($id: ID!) {
    licenseDraft(id: $id) {
      ${DRAFT_FIELDS}
    }
  }
`;

const CREATE_NOVEL = `#graphql
  mutation CreateNovel($input: CreateNovelInput!) {
    createNovel(input: $input) {
      id
      license {
        id
      }
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

function uniqueText() {
  return `You may read this novel. You may not copy it. ${randomUUID()}`;
}

describe('License drafts (e2e)', () => {
  let writer: string;
  let otherWriter: string;

  async function listIds(
    variables: Record<string, unknown>,
    authorization: string,
  ): Promise<string[]> {
    const data = await graphql(
      LICENSE_DRAFTS_CONNECTION,
      variables,
      authorization,
    );

    return data.data.licenseDraftsConnection.edges.map(
      ({ node }: { node: { id: string } }) => node.id,
    );
  }

  async function startDraft(
    authorization = writer,
    text = uniqueText(),
  ) {
    const created = await graphql(
      CREATE_LICENSE_DRAFT,
      { input: {} },
      authorization,
    );
    const saved = await graphql(
      SAVE_LICENSE_DRAFT,
      {
        input: {
          id: created.data.createLicenseDraft.id,
          title: 'Read it, do not copy it',
          text,
          source: { type: 'CUSTOM' },
        },
      },
      authorization,
    );

    return saved.data.saveLicenseDraft;
  }

  beforeAll(async () => {
    writer =
      await AuthorizationFixture.getWriterAuthorizationHeader();
    otherWriter =
      await AuthorizationFixture.getSecondWriterAuthorizationHeader();
  });

  it('should let a writer create, save, list and read a draft, and discard it', async () => {
    const draft = await startDraft();

    const listed = await listIds({}, writer);
    const read = await graphql(
      LICENSE_DRAFT,
      { id: draft.id },
      writer,
    );
    const discarded = await graphql(
      DISCARD_LICENSE_DRAFT,
      { id: draft.id },
      writer,
    );
    const afterwards = await graphql(
      LICENSE_DRAFT,
      { id: draft.id },
      writer,
    );

    expect(listed).toContain(draft.id);
    expect(read.data.licenseDraft.text).toBe(draft.text);
    expect(discarded.data.discardLicenseDraft).toBeTrue();
    expect(afterwards.errors[0].message).toContain('not found');
  });

  describe('another writer', () => {
    it.each([
      {
        operation: 'read',
        query: LICENSE_DRAFT,
        variables: (id: string) => ({ id }),
      },
      {
        operation: 'save',
        query: SAVE_LICENSE_DRAFT,
        variables: (id: string) => ({
          input: {
            id,
            title: 'Mine now',
            text: 'Stolen',
            source: { type: 'CUSTOM' },
          },
        }),
      },
      {
        operation: 'finalize',
        query: FINALIZE_LICENSE_DRAFT,
        variables: (id: string) => ({ id }),
      },
      {
        operation: 'discard',
        query: DISCARD_LICENSE_DRAFT,
        variables: (id: string) => ({ id }),
      },
    ])(
      'should not be able to $operation it',
      async ({ query, variables }) => {
        const draft = await startDraft();

        const data = await graphql(
          query,
          variables(draft.id),
          otherWriter,
        );
        const own = await graphql(
          LICENSE_DRAFT,
          { id: draft.id },
          writer,
        );

        expect(data.errors[0].message).toContain('not found');
        expect(own.data.licenseDraft.text).toBe(draft.text);
      },
    );

    it('should not see it in their list', async () => {
      const draft = await startDraft();

      const listed = await listIds({}, otherWriter);

      expect(listed).not.toContain(draft.id);
    });
  });

  describe('listing', () => {
    it('should page through the drafts of a writer', async () => {
      const first = await startDraft();
      const second = await startDraft();
      const third = await startDraft();

      const page = await graphql(
        LICENSE_DRAFTS_CONNECTION,
        { first: 2 },
        writer,
      );
      const connection = page.data.licenseDraftsConnection;
      const next = await graphql(
        LICENSE_DRAFTS_CONNECTION,
        { first: 100, after: connection.pageInfo.endCursor },
        writer,
      );
      const seen = [
        ...connection.edges,
        ...next.data.licenseDraftsConnection.edges,
      ].map(({ node }: { node: { id: string } }) => node.id);

      expect(connection.edges).toHaveLength(2);
      expect(connection.pageInfo.hasNextPage).toBeTrue();
      expect(new Set(seen).size).toBe(seen.length);
      expect(seen).toEqual(
        expect.arrayContaining([first.id, second.id, third.id]),
      );
    });

    it('should let a writer name themselves, and refuse them anybody else', async () => {
      const draft = await startDraft();
      const own = await listIds(
        { filters: { ownerIds: [draft.ownerId] } },
        writer,
      );

      const other = await graphql(
        LICENSE_DRAFTS_CONNECTION,
        { filters: { ownerIds: [draft.ownerId] } },
        otherWriter,
      );

      expect(own).toContain(draft.id);
      expect(other.errors[0].message).toContain('only their own');
    });

    it("should let an admin list every writer's drafts, or the writers they name, and read them", async () => {
      const admin =
        await AuthorizationFixture.getAdminAuthorizationHeader();
      const mine = await startDraft(writer);
      const theirs = await startDraft(otherWriter);

      const everyone = await listIds({ first: 100 }, admin);
      const named = await listIds(
        { filters: { ownerIds: [mine.ownerId, theirs.ownerId] } },
        admin,
      );
      const onlyOne = await listIds(
        { filters: { ownerIds: [theirs.ownerId] } },
        admin,
      );
      const read = await graphql(
        LICENSE_DRAFT,
        { id: theirs.id },
        admin,
      );

      expect(everyone).toEqual(
        expect.arrayContaining([mine.id, theirs.id]),
      );
      expect(named).toEqual(
        expect.arrayContaining([mine.id, theirs.id]),
      );
      expect(onlyOne).toContain(theirs.id);
      expect(onlyOne).not.toContain(mine.id);
      expect(read.data.licenseDraft.text).toBe(theirs.text);
    });

    it.each([
      {
        operation: 'save',
        query: SAVE_LICENSE_DRAFT,
        variables: (id: string) => ({
          input: {
            id,
            title: 'Admin edit',
            text: 'Changed',
            source: { type: 'CUSTOM' },
          },
        }),
      },
      {
        operation: 'finalize',
        query: FINALIZE_LICENSE_DRAFT,
        variables: (id: string) => ({ id }),
      },
      {
        operation: 'discard',
        query: DISCARD_LICENSE_DRAFT,
        variables: (id: string) => ({ id }),
      },
    ])(
      'should not let an admin $operation the draft of a writer',
      async ({ query, variables }) => {
        const admin =
          await AuthorizationFixture.getAdminAuthorizationHeader();
        const draft = await startDraft();

        const data = await graphql(query, variables(draft.id), admin);
        const own = await graphql(
          LICENSE_DRAFT,
          { id: draft.id },
          writer,
        );

        expect(data.errors[0].message).toContain('not found');
        expect(own.data.licenseDraft.text).toBe(draft.text);
      },
    );
  });

  it('should not let a reader use drafts', async () => {
    const reader =
      await AuthorizationFixture.getUserAuthorizationHeader();

    const data = await graphql(
      CREATE_LICENSE_DRAFT,
      { input: {} },
      reader,
    );

    expect(data.errors).not.toBeEmpty();
    expect(data.data).toBeNull();
  });

  it('should not let a writer who has not accepted the platform terms create one', async () => {
    const unaccepted =
      await AuthorizationFixture.getWriterWithoutAcceptedTermsAuthorizationHeader();

    const data = await graphql(
      CREATE_LICENSE_DRAFT,
      { input: {} },
      unaccepted,
    );

    expect(data.errors[0].extensions.code).toBe(
      'PLATFORM_TERMS_NOT_ACCEPTED',
    );
  });

  describe('finalizing', () => {
    it('should give a license that can be put on a novel, and the draft is gone', async () => {
      const draft = await startDraft();

      const finalized = await graphql(
        FINALIZE_LICENSE_DRAFT,
        { id: draft.id },
        writer,
      );
      const license = finalized.data.finalizeLicenseDraft;
      const novel = await graphql(
        CREATE_NOVEL,
        {
          input: {
            name: 'The Lantern Keeper',
            author: 'Jane Doe',
            description:
              'A lighthouse keeper finds a door in the fog.',
            licenseId: license.id,
          },
        },
        writer,
      );
      const afterwards = await graphql(
        LICENSE_DRAFT,
        { id: draft.id },
        writer,
      );

      expect(license.text).toBe(draft.text);
      expect(license.sourceType).toBe('CUSTOM');
      expect(novel.data.createNovel.license.id).toBe(license.id);
      expect(afterwards.data).toBeNull();
    });

    it('should give each writer their own license for the same text, and one license to a writer who finalizes it twice', async () => {
      const text = uniqueText();
      const first = await startDraft(writer, text);
      const again = await startDraft(writer, text);
      const second = await startDraft(otherWriter, text);

      const one = await graphql(
        FINALIZE_LICENSE_DRAFT,
        { id: first.id },
        writer,
      );
      const same = await graphql(
        FINALIZE_LICENSE_DRAFT,
        { id: again.id },
        writer,
      );
      const two = await graphql(
        FINALIZE_LICENSE_DRAFT,
        { id: second.id },
        otherWriter,
      );

      expect(same.data.finalizeLicenseDraft.id).toBe(
        one.data.finalizeLicenseDraft.id,
      );
      expect(two.data.finalizeLicenseDraft.id).not.toBe(
        one.data.finalizeLicenseDraft.id,
      );
    });

    it('should keep a draft that is not finished', async () => {
      const created = await graphql(
        CREATE_LICENSE_DRAFT,
        { input: {} },
        writer,
      );
      const id = created.data.createLicenseDraft.id;

      const finalized = await graphql(
        FINALIZE_LICENSE_DRAFT,
        { id },
        writer,
      );
      const stillThere = await graphql(LICENSE_DRAFT, { id }, writer);

      expect(finalized.errors[0].message).toContain(
        'needs a name and a text',
      );
      expect(stillThere.data.licenseDraft.id).toBe(id);
    });
  });

  it('should not accept a draft as the license of a novel', async () => {
    const draft = await startDraft();

    const data = await graphql(
      CREATE_NOVEL,
      {
        input: {
          name: 'The Lantern Keeper',
          author: 'Jane Doe',
          description: 'A lighthouse keeper finds a door in the fog.',
          licenseId: draft.id,
        },
      },
      writer,
    );

    expect(data.errors[0].message).toContain('not found');
  });

  it("should not let another writer put a writer's license on their novel", async () => {
    const draft = await startDraft();
    const finalized = await graphql(
      FINALIZE_LICENSE_DRAFT,
      { id: draft.id },
      writer,
    );

    const data = await graphql(
      CREATE_NOVEL,
      {
        input: {
          name: 'The Lantern Keeper',
          author: 'Jane Doe',
          description: 'A lighthouse keeper finds a door in the fog.',
          licenseId: finalized.data.finalizeLicenseDraft.id,
        },
      },
      otherWriter,
    );

    expect(data.errors[0].message).toContain('not found');
  });

  it("should not start a draft from another writer's license", async () => {
    const draft = await startDraft();
    const finalized = await graphql(
      FINALIZE_LICENSE_DRAFT,
      { id: draft.id },
      writer,
    );

    const data = await graphql(
      CREATE_LICENSE_DRAFT,
      {
        input: { licenseId: finalized.data.finalizeLicenseDraft.id },
      },
      otherWriter,
    );

    expect(data.errors[0].message).toContain('not found');
  });
});

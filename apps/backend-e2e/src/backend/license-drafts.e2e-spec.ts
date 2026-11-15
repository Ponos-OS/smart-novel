import axios from 'axios';
import { randomUUID } from 'node:crypto';

import { AuthorizationFixture } from '../support';

const DRAFT_FIELDS = `
  id
  ownerID
  scope
  name
  text
  sourceType
  canonicalID
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

const DRAFTS = `#graphql
  query Drafts(
    $first: Int,
    $after: Cursor,
    $where: LicenseWhereInput
  ) {
    licenses(first: $first, after: $after, scope: DRAFT, where: $where) {
      edges {
        cursor
        node {
          id
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

const LICENSE_DRAFT = `#graphql
  query LicenseDraft($id: ID!) {
    licenseDraft(id: $id) {
      ${DRAFT_FIELDS}
    }
  }
`;

const CREATE_LICENSE = `#graphql
  mutation CreateLicense($input: LicenseInput!) {
    createLicense(input: $input) {
      id
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
    const data = await graphql(DRAFTS, variables, authorization);

    return data.data.licenses.edges.map(
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
          name: 'Read it, do not copy it',
          text,
          sourceType: 'CUSTOM',
        },
      },
      authorization,
    );

    return saved.data.saveLicenseDraft;
  }

  beforeAll(async () => {
    // Fresh writers: a writer may keep only 20 unfinished drafts, and this spec leaves some behind.
    writer = await AuthorizationFixture.getWriterAuthorizationHeader({
      fresh: true,
    });
    otherWriter =
      await AuthorizationFixture.getWriterAuthorizationHeader({
        fresh: true,
      });
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
            name: 'Mine now',
            text: 'Stolen',
            sourceType: 'CUSTOM',
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

      const page = await graphql(DRAFTS, { first: 2 }, writer);
      const connection = page.data.licenses;
      const next = await graphql(
        DRAFTS,
        { first: 100, after: connection.pageInfo.endCursor },
        writer,
      );
      const seen = [
        ...connection.edges,
        ...next.data.licenses.edges,
      ].map(({ node }: { node: { id: string } }) => node.id);

      expect(connection.edges).toHaveLength(2);
      expect(connection.pageInfo.hasNextPage).toBeTrue();
      expect(new Set(seen).size).toBe(seen.length);
      expect(seen).toEqual(
        expect.arrayContaining([first.id, second.id, third.id]),
      );
    });

    it('should let a writer name themselves, and show them nothing of anybody else', async () => {
      const draft = await startDraft();
      const own = await listIds(
        { where: { ownerIDIn: [draft.ownerID] } },
        writer,
      );

      const other = await listIds(
        { first: 100, where: { ownerIDIn: [draft.ownerID] } },
        otherWriter,
      );

      expect(own).toContain(draft.id);
      expect(other).not.toContain(draft.id);
      expect(other).toBeEmpty();
    });

    it("should let an admin list every writer's drafts, or the writers they name, and read them", async () => {
      const admin =
        await AuthorizationFixture.getAdminAuthorizationHeader();
      const mine = await startDraft(writer);
      const theirs = await startDraft(otherWriter);

      const everyone = await listIds({ first: 100 }, admin);
      const named = await listIds(
        {
          first: 100,
          where: { ownerIDIn: [mine.ownerID, theirs.ownerID] },
        },
        admin,
      );
      const onlyOne = await listIds(
        { first: 100, where: { ownerIDIn: [theirs.ownerID] } },
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
            name: 'Admin edit',
            text: 'Changed',
            sourceType: 'CUSTOM',
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
      await AuthorizationFixture.getWriterAuthorizationHeader({
        fresh: true,
        acceptTerms: false,
      });

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
            description:
              'A lighthouse keeper finds a door in the fog.',
            licenseID: license.id,
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

    it('should give the shared license to a writer who finalizes its exact text', async () => {
      const admin =
        await AuthorizationFixture.getAdminAuthorizationHeader();
      const text = uniqueText();
      const shared = await graphql(
        CREATE_LICENSE,
        {
          input: {
            name: 'Read it, do not copy it',
            text,
            sourceType: 'CUSTOM',
          },
        },
        admin,
      );
      const draft = await startDraft(writer, text);

      const finalized = await graphql(
        FINALIZE_LICENSE_DRAFT,
        { id: draft.id },
        writer,
      );

      expect(finalized.data.finalizeLicenseDraft.id).toBe(
        shared.data.createLicense.id,
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

  it('should limit a writer to 20 unfinished drafts, without limiting another writer', async () => {
    const busyWriter =
      await AuthorizationFixture.getWriterAuthorizationHeader({
        fresh: true,
      });
    for (let count = 0; count < 20; count++) {
      await graphql(CREATE_LICENSE_DRAFT, { input: {} }, busyWriter);
    }

    const tooMany = await graphql(
      CREATE_LICENSE_DRAFT,
      { input: {} },
      busyWriter,
    );
    const other = await graphql(
      CREATE_LICENSE_DRAFT,
      { input: {} },
      otherWriter,
    );

    expect(tooMany.errors).toBeDefined();
    expect(tooMany.data).toBeNull();
    expect(other.data.createLicenseDraft.id).toBeString();
  });

  it('should not accept a draft as the license of a novel', async () => {
    const draft = await startDraft();

    const data = await graphql(
      CREATE_NOVEL,
      {
        input: {
          name: 'The Lantern Keeper',
          description: 'A lighthouse keeper finds a door in the fog.',
          licenseID: draft.id,
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
          description: 'A lighthouse keeper finds a door in the fog.',
          licenseID: finalized.data.finalizeLicenseDraft.id,
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
        input: { licenseID: finalized.data.finalizeLicenseDraft.id },
      },
      otherWriter,
    );

    expect(data.errors[0].message).toContain('not found');
  });
});

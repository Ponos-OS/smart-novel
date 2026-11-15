import { randomUUID } from 'node:crypto';

import { AuthorizationFixture, graphql } from '../support';

const DEFAULT_LICENSE = `#graphql
  query DefaultLicense {
    defaultLicense {
      id
      name
      sourceType
      canonicalID
      text
    }
  }
`;

const SET_DEFAULT_LICENSE = `#graphql
  mutation SetDefaultLicense($licenseID: ID!) {
    setDefaultLicense(licenseID: $licenseID) {
      id
      name
      sourceType
      canonicalID
      text
    }
  }
`;

const CREATE_LICENSE = `#graphql
  mutation CreateLicense($input: LicenseInput!) {
    createLicense(input: $input) {
      id
      name
      sourceType
      canonicalID
      text
      scope
      isDefault
      ownerID
      officialURL
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
      name
      sourceType
      canonicalID
      scope
      ownerID
      officialURL
    }
  }
`;

const CREATE_NOVEL = `#graphql
  mutation CreateNovel($input: CreateNovelInput!) {
    createNovel(input: $input) {
      id
    }
  }
`;

const UPDATE_NOVEL = `#graphql
  mutation UpdateNovel($id: ID!, $input: UpdateNovelInput!) {
    updateNovel(id: $id, input: $input) {
      id
    }
  }
`;

const NOVEL_LICENSE = `#graphql
  query NovelLicense($id: ID!) {
    novel(id: $id) {
      license {
        id
        name
        sourceType
        text
      }
    }
  }
`;

const NOVELS_LICENSES = `#graphql
  query NovelsLicenses {
    novels(first: 50) {
      edges {
        node {
          id
          license {
            id
          }
        }
      }
    }
  }
`;

function uniqueLicense() {
  return {
    name: 'Read it, do not copy it',
    text: `You may read this novel. You may not copy it. ${randomUUID()}`,
    sourceType: 'CUSTOM',
  };
}

/**
 * @description A writer stores a license through a draft: the only way for them to get a new text, since the novel takes only the ID of a license.
 */
async function finalizeLicense(
  authorization: string,
  license: {
    name: string;
    text: string;
    sourceType: string;
    canonicalID?: string;
  },
) {
  const created = await graphql(
    CREATE_LICENSE_DRAFT,
    { input: {} },
    authorization,
  );
  const id = created.data.createLicenseDraft.id;
  await graphql(
    SAVE_LICENSE_DRAFT,
    { input: { id, ...license } },
    authorization,
  );

  return graphql(FINALIZE_LICENSE_DRAFT, { id }, authorization);
}

describe('Licenses (e2e)', () => {
  const novelInput = {
    name: 'The Lantern Keeper',
    description: 'A lighthouse keeper finds a door in the fog.',
  };
  let adminAuthorization: string;
  let writer: string;
  let originalDefaultId: string;

  beforeAll(async () => {
    adminAuthorization =
      await AuthorizationFixture.getAdminAuthorizationHeader();
    // Fresh: the refused drafts stay behind, and a writer may keep only 20.
    writer = await AuthorizationFixture.getWriterAuthorizationHeader({
      fresh: true,
    });

    const data = await graphql(
      DEFAULT_LICENSE,
      {},
      adminAuthorization,
    );

    originalDefaultId = data.data.defaultLicense.id;
  });

  afterAll(async () => {
    await graphql(
      SET_DEFAULT_LICENSE,
      { licenseID: originalDefaultId },
      adminAuthorization,
    );
  });

  describe('defaultLicense', () => {
    it('should be the seeded CC BY 4.0', async () => {
      const data = await graphql(DEFAULT_LICENSE, {}, writer);

      expect(data.errors).toBeUndefined();
      expect(data.data.defaultLicense).toStrictEqual({
        id: originalDefaultId,
        name: 'CC BY 4.0',
        sourceType: 'CANONICAL',
        canonicalID: 'CC-BY-4.0',
        text: expect.stringContaining(
          'Attribution 4.0 International',
        ),
      });
    });
  });

  describe('setDefaultLicense', () => {
    it.each([
      {
        role: 'user',
        getAuthorizationHeader:
          AuthorizationFixture.getUserAuthorizationHeader,
      },
      {
        role: 'writer',
        getAuthorizationHeader:
          AuthorizationFixture.getWriterAuthorizationHeader,
      },
    ])(
      'should not allow $role to change the default',
      async ({ getAuthorizationHeader }) => {
        const authorization = await getAuthorizationHeader();

        const data = await graphql(
          SET_DEFAULT_LICENSE,
          { licenseID: originalDefaultId },
          authorization,
        );

        expect(data.errors).toBeDefined();
        expect(data.data).toBeNull();
      },
    );

    it('should let an admin change the default, and keep exactly one', async () => {
      const created = await graphql(
        CREATE_LICENSE,
        { input: uniqueLicense() },
        adminAuthorization,
      );

      const changed = await graphql(
        SET_DEFAULT_LICENSE,
        { licenseID: created.data.createLicense.id },
        adminAuthorization,
      );
      const current = await graphql(
        DEFAULT_LICENSE,
        {},
        adminAuthorization,
      );

      expect(changed.errors).toBeUndefined();
      expect(changed.data.setDefaultLicense).toStrictEqual({
        id: created.data.createLicense.id,
        name: created.data.createLicense.name,
        sourceType: 'CUSTOM',
        canonicalID: null,
        text: created.data.createLicense.text,
      });
      expect(current.data.defaultLicense.id).toBe(
        changed.data.setDefaultLicense.id,
      );
    });

    it("should refuse a writer's own license as the default", async () => {
      const finalized = await finalizeLicense(
        writer,
        uniqueLicense(),
      );

      const data = await graphql(
        SET_DEFAULT_LICENSE,
        { licenseID: finalized.data.finalizeLicenseDraft.id },
        adminAuthorization,
      );

      expect(data.errors[0].message).toContain('not found');
    });
  });

  describe('createLicense', () => {
    it.each([
      {
        role: 'user',
        getAuthorizationHeader:
          AuthorizationFixture.getUserAuthorizationHeader,
      },
      {
        role: 'writer',
        getAuthorizationHeader:
          AuthorizationFixture.getWriterAuthorizationHeader,
      },
    ])(
      'should not allow $role to create a shared license',
      async ({ getAuthorizationHeader }) => {
        const authorization = await getAuthorizationHeader();

        const data = await graphql(
          CREATE_LICENSE,
          { input: uniqueLicense() },
          authorization,
        );

        expect(data.errors).toBeDefined();
        expect(data.data).toBeNull();
      },
    );

    it('should let an admin store a shared license without changing the default', async () => {
      const license = uniqueLicense();

      const created = await graphql(
        CREATE_LICENSE,
        { input: license },
        adminAuthorization,
      );
      const current = await graphql(
        DEFAULT_LICENSE,
        {},
        adminAuthorization,
      );

      expect(created.errors).toBeUndefined();
      expect(created.data.createLicense).toStrictEqual({
        id: expect.toBeString(),
        name: license.name,
        sourceType: 'CUSTOM',
        canonicalID: null,
        text: license.text,
        scope: 'SHARED',
        isDefault: false,
        ownerID: 'system',
        officialURL: null,
      });
      expect(current.data.defaultLicense.id).not.toBe(
        created.data.createLicense.id,
      );
    });

    it('should return the stored license when the same text is created again', async () => {
      const license = uniqueLicense();

      const first = await graphql(
        CREATE_LICENSE,
        { input: license },
        adminAuthorization,
      );
      const second = await graphql(
        CREATE_LICENSE,
        { input: { ...license, text: `${license.text}  \r\n` } },
        adminAuthorization,
      );

      expect(second.data.createLicense.id).toBe(
        first.data.createLicense.id,
      );
    });

    it.each([
      {
        scenario: 'its text is not the registry text',
        input: {
          ...uniqueLicense(),
          sourceType: 'CANONICAL',
          canonicalID: 'CC-BY-4.0',
        },
        message: 'is not the canonical license',
      },
      {
        scenario: 'it claims to be canonical without saying which',
        input: { ...uniqueLicense(), sourceType: 'CANONICAL' },
        message: 'needs its canonicalId',
      },
      {
        scenario: 'it is a fork without saying what it forks',
        input: { ...uniqueLicense(), sourceType: 'FORKED' },
        message: 'needs the canonicalId it was modified from',
      },
      {
        scenario: 'it is custom and still names a canonical license',
        input: { ...uniqueLicense(), canonicalID: 'CC-BY-4.0' },
        message: 'has no canonicalId',
      },
    ])(
      'should refuse a license when $scenario',
      async ({ input, message }) => {
        const data = await graphql(
          CREATE_LICENSE,
          { input },
          adminAuthorization,
        );

        expect(data.errors[0].message).toContain(message);
      },
    );
  });

  describe('licenses on novels', () => {
    it('should give a writer a shared license they can put on their novel', async () => {
      const created = await graphql(
        CREATE_LICENSE,
        { input: uniqueLicense() },
        adminAuthorization,
      );
      const licenseID = created.data.createLicense.id;

      const novel = await graphql(
        CREATE_NOVEL,
        { input: { ...novelInput, licenseID } },
        writer,
      );
      const licensed = await graphql(
        NOVEL_LICENSE,
        { id: novel.data.createNovel.id },
        writer,
      );

      expect(novel.errors).toBeUndefined();
      expect(licensed.data.novel.license.id).toBe(licenseID);
    });

    it('should let a writer create a novel with their own license and then switch it to an existing one', async () => {
      const own = await finalizeLicense(writer, uniqueLicense());
      const ownID = own.data.finalizeLicenseDraft.id;

      const created = await graphql(
        CREATE_NOVEL,
        { input: { ...novelInput, licenseID: ownID } },
        writer,
      );
      const updated = await graphql(
        UPDATE_NOVEL,
        {
          id: created.data.createNovel.id,
          input: { licenseID: originalDefaultId },
        },
        writer,
      );
      const licensed = await graphql(
        NOVEL_LICENSE,
        { id: created.data.createNovel.id },
        writer,
      );

      expect(created.errors).toBeUndefined();
      expect(updated.errors).toBeUndefined();
      expect(licensed.data.novel.license.id).toBe(originalDefaultId);
    });

    it('should give a novel the current default license when none is chosen', async () => {
      const current = await graphql(DEFAULT_LICENSE, {}, writer);

      const novel = await graphql(
        CREATE_NOVEL,
        { input: novelInput },
        writer,
      );
      const licensed = await graphql(
        NOVEL_LICENSE,
        { id: novel.data.createNovel.id },
        writer,
      );

      expect(licensed.data.novel.license.id).toBe(
        current.data.defaultLicense.id,
      );
    });

    it('should expose the license of a novel on the detail and on the list', async () => {
      const license = uniqueLicense();
      const own = await finalizeLicense(writer, license);
      const created = await graphql(
        CREATE_NOVEL,
        {
          input: {
            ...novelInput,
            licenseID: own.data.finalizeLicenseDraft.id,
          },
        },
        writer,
      );
      const novelId = created.data.createNovel.id;

      const detail = await graphql(
        NOVEL_LICENSE,
        { id: novelId },
        '',
      );
      const list = await graphql(NOVELS_LICENSES, {}, '');

      expect(detail.data.novel.license).toEqual(
        expect.objectContaining({
          name: license.name,
          sourceType: 'CUSTOM',
          text: license.text,
        }),
      );
      expect(list.errors).toBeUndefined();
      expect(list.data.novels.edges).not.toBeEmpty();
      expect(
        list.data.novels.edges.every(
          ({ node }: { node: { license: { id: string } } }) =>
            node.license.id,
        ),
      ).toBeTrue();
    });

    it('should reject creating a novel with a license that does not exist', async () => {
      const data = await graphql(
        CREATE_NOVEL,
        { input: { ...novelInput, licenseID: randomUUID() } },
        writer,
      );

      expect(data.errors[0].message).toContain('not found');
    });
  });

  describe('canonical licenses of the Fithara registry', () => {
    const canonicalID = 'CC-BY-NC-4.0';
    let writer: string;

    beforeAll(async () => {
      // Fresh: the refused drafts stay behind, and a writer may keep only 20.
      writer =
        await AuthorizationFixture.getWriterAuthorizationHeader({
          fresh: true,
        });
    });

    async function draftFromRegistry(writer: string) {
      const created = await graphql(
        CREATE_LICENSE_DRAFT,
        { input: { canonicalID } },
        writer,
      );

      return created.data.createLicenseDraft.id as string;
    }

    it('should store the registry text as a shared canonical license, under the name of the registry, with its official link', async () => {
      const id = await draftFromRegistry(writer);

      const data = await graphql(
        FINALIZE_LICENSE_DRAFT,
        { id },
        writer,
      );

      expect(data.errors).toBeUndefined();
      expect(data.data.finalizeLicenseDraft).toStrictEqual({
        id: expect.toBeString(),
        name: 'CC BY-NC 4.0',
        sourceType: 'CANONICAL',
        canonicalID,
        scope: 'SHARED',
        ownerID: 'system',
        officialURL: expect.stringContaining('creativecommons.org'),
      });
    });

    it('should refuse a draft that claims to be canonical but is not the registry text', async () => {
      const id = await draftFromRegistry(writer);
      await graphql(
        SAVE_LICENSE_DRAFT,
        {
          input: {
            id,
            name: 'CC BY-NC 4.0',
            text: `${uniqueLicense().text}\n\nYou may also sell it.`,
            sourceType: 'CANONICAL',
            canonicalID,
          },
        },
        writer,
      );

      const data = await graphql(
        FINALIZE_LICENSE_DRAFT,
        { id },
        writer,
      );

      expect(data.errors[0].message).toContain(
        `is not the canonical license ${canonicalID}`,
      );
    });

    it('should refuse a draft from a canonical license the registry does not know', async () => {
      const data = await graphql(
        CREATE_LICENSE_DRAFT,
        { input: { canonicalID: 'NOT-A-LICENSE' } },
        writer,
      );

      expect(data.errors[0].message).toContain(
        'is not a known canonical license',
      );
    });
  });
});

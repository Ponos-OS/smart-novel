import axios from 'axios';
import { randomUUID } from 'node:crypto';

import { AuthorizationFixture } from '../support';

const DEFAULT_LICENSE = `#graphql
  query DefaultLicense {
    defaultLicense {
      id
      name
      sourceType
      canonicalId
      text
    }
  }
`;

const SET_DEFAULT_LICENSE = `#graphql
  mutation SetDefaultLicense($input: SetDefaultLicenseInput!) {
    setDefaultLicense(input: $input) {
      id
      name
      sourceType
      canonicalId
      text
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
    novelsConnection(first: 50) {
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

const CANONICAL_LICENSES = `#graphql
  query CanonicalLicenses {
    canonicalLicenses {
      id
      shortName
      officialUrl
    }
  }
`;

const CANONICAL_LICENSE = `#graphql
  query CanonicalLicense($id: ID!) {
    canonicalLicense(id: $id) {
      id
      shortName
      body
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
      headers: authorization ? { Authorization: authorization } : {},
      validateStatus: () => true,
    },
  );

  return data;
}

function uniqueDraft() {
  return {
    title: 'Read it, do not copy it',
    text: `You may read this novel. You may not copy it. ${randomUUID()}`,
    source: { type: 'CUSTOM' },
  };
}

describe('Licenses (e2e)', () => {
  const novelInput = {
    name: 'The Lantern Keeper',
    author: 'Jane Doe',
    description: 'A lighthouse keeper finds a door in the fog.',
  };
  let adminAuthorization: string;
  let originalDefaultId: string;

  beforeAll(async () => {
    adminAuthorization =
      await AuthorizationFixture.getAdminAuthorizationHeader();

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
      { input: { licenseId: originalDefaultId } },
      adminAuthorization,
    );
  });

  describe('defaultLicense', () => {
    it('should be the seeded CC BY 4.0', async () => {
      const writer =
        await AuthorizationFixture.getWriterAuthorizationHeader();

      const data = await graphql(DEFAULT_LICENSE, {}, writer);

      expect(data.errors).toBeUndefined();
      expect(data.data.defaultLicense).toStrictEqual({
        id: originalDefaultId,
        name: 'CC BY 4.0',
        sourceType: 'CANONICAL',
        canonicalId: 'CC-BY-4.0',
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
          { input: { licenseId: originalDefaultId } },
          authorization,
        );

        expect(data.errors[0].message).toContain(
          'You do not have permission to update this license',
        );
      },
    );

    it('should let an admin change the default, and keep exactly one', async () => {
      const draft = uniqueDraft();

      const changed = await graphql(
        SET_DEFAULT_LICENSE,
        { input: { licenseDraft: draft } },
        adminAuthorization,
      );
      const current = await graphql(
        DEFAULT_LICENSE,
        {},
        adminAuthorization,
      );

      expect(changed.errors).toBeUndefined();
      expect(changed.data.setDefaultLicense).toStrictEqual({
        id: expect.toBeString(),
        name: draft.title,
        sourceType: 'CUSTOM',
        canonicalId: null,
        text: draft.text,
      });
      expect(current.data.defaultLicense.id).toBe(
        changed.data.setDefaultLicense.id,
      );
    });

    it('should reject a call that selects nothing', async () => {
      const data = await graphql(
        SET_DEFAULT_LICENSE,
        { input: {} },
        adminAuthorization,
      );

      expect(data.errors[0].message).toContain(
        'Pass either licenseId or licenseDraft',
      );
    });
  });

  describe('license draft on novels', () => {
    it('should store a distinct text once, however many times it is sent', async () => {
      const draft = uniqueDraft();

      const first = await graphql(
        SET_DEFAULT_LICENSE,
        { input: { licenseDraft: draft } },
        adminAuthorization,
      );
      const second = await graphql(
        SET_DEFAULT_LICENSE,
        {
          input: {
            licenseDraft: { ...draft, text: `${draft.text}  \r\n` },
          },
        },
        adminAuthorization,
      );

      expect(second.data.setDefaultLicense.id).toBe(
        first.data.setDefaultLicense.id,
      );
    });

    it('should let a writer create a novel with their own draft and then switch it to an existing license', async () => {
      const writer =
        await AuthorizationFixture.getWriterAuthorizationHeader();

      const created = await graphql(
        CREATE_NOVEL,
        { input: { ...novelInput, licenseDraft: uniqueDraft() } },
        writer,
      );
      const updated = await graphql(
        UPDATE_NOVEL,
        {
          id: created.data.createNovel.id,
          input: { licenseId: originalDefaultId },
        },
        writer,
      );

      expect(created.errors).toBeUndefined();
      expect(updated.errors).toBeUndefined();
    });

    it('should expose the license of a novel on the detail and on the list', async () => {
      const writer =
        await AuthorizationFixture.getWriterAuthorizationHeader();
      const draft = uniqueDraft();
      const created = await graphql(
        CREATE_NOVEL,
        { input: { ...novelInput, licenseDraft: draft } },
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
          name: draft.title,
          sourceType: 'CUSTOM',
          text: draft.text,
        }),
      );
      expect(list.errors).toBeUndefined();
      expect(list.data.novelsConnection.edges).not.toBeEmpty();
      expect(
        list.data.novelsConnection.edges.every(
          ({ node }: { node: { license: { id: string } } }) =>
            node.license.id,
        ),
      ).toBeTrue();
    });

    it.each([
      {
        scenario: 'both an id and a draft are sent',
        license: {
          licenseId: randomUUID(),
          licenseDraft: uniqueDraft(),
        },
        message: 'either licenseId or licenseDraft',
      },
      {
        scenario: 'the license does not exist',
        license: { licenseId: randomUUID() },
        message: 'not found',
      },
      {
        scenario:
          'a text claims to be canonical without saying which',
        license: {
          licenseDraft: {
            ...uniqueDraft(),
            source: { type: 'CANONICAL' },
          },
        },
        message: 'needs its canonicalId',
      },
    ])(
      'should reject creating a novel when $scenario',
      async ({ license, message }) => {
        const writer =
          await AuthorizationFixture.getWriterAuthorizationHeader();

        const data = await graphql(
          CREATE_NOVEL,
          { input: { ...novelInput, ...license } },
          writer,
        );

        expect(data.errors[0].message).toContain(message);
      },
    );
  });

  describe('canonical licenses of the Fithara registry', () => {
    const canonicalId = 'CC-BY-NC-4.0';

    async function readCanonicalLicense(writer: string) {
      const data = await graphql(
        CANONICAL_LICENSE,
        { id: canonicalId },
        writer,
      );

      return data.data.canonicalLicense;
    }

    it('should list the registry for a writer', async () => {
      const writer =
        await AuthorizationFixture.getWriterAuthorizationHeader();

      const data = await graphql(CANONICAL_LICENSES, {}, writer);

      expect(
        data.data.canonicalLicenses.map(
          ({ id }: { id: string }) => id,
        ),
      ).toContain(canonicalId);
    });

    it('should store the registry text as a canonical license, under the name of the registry', async () => {
      const writer =
        await AuthorizationFixture.getWriterAuthorizationHeader();
      const canonical = await readCanonicalLicense(writer);

      const data = await graphql(
        CREATE_NOVEL,
        {
          input: {
            ...novelInput,
            licenseDraft: {
              title: 'Whatever the client calls it',
              text: canonical.body,
              source: { type: 'CANONICAL', canonicalId },
            },
          },
        },
        writer,
      );

      expect(data.errors).toBeUndefined();
    });

    it('should refuse a text that claims to be canonical but is not the registry text', async () => {
      const writer =
        await AuthorizationFixture.getWriterAuthorizationHeader();
      const canonical = await readCanonicalLicense(writer);

      const data = await graphql(
        CREATE_NOVEL,
        {
          input: {
            ...novelInput,
            licenseDraft: {
              title: canonical.shortName,
              text: `${canonical.body}\n\nYou may also sell it.`,
              source: { type: 'CANONICAL', canonicalId },
            },
          },
        },
        writer,
      );

      expect(data.errors[0].message).toContain(
        `is not the canonical license ${canonicalId}`,
      );
    });
  });
});

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
        scenario: 'an unknown text claims to be canonical',
        license: {
          licenseDraft: {
            ...uniqueDraft(),
            source: { type: 'CANONICAL', canonicalId: 'CC-BY-4.0' },
          },
        },
        message: 'not a known canonical license',
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
});

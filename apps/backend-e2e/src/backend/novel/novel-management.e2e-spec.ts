import axios from 'axios';
import { randomUUID } from 'node:crypto';

import { AuthorizationFixture } from '../../support';

const CREATE_NOVEL = `#graphql
  mutation CreateNovel($input: CreateNovelInput!) {
    createNovel(input: $input) {
      id
      name
      writer {
        penName
      }
      description
      state
      tags
      allowedActions
    }
  }
`;

const UPDATE_NOVEL = `#graphql
  mutation UpdateNovel($id: ID!, $input: UpdateNovelInput!) {
    updateNovel(id: $id, input: $input) {
      id
      name
      writer {
        penName
      }
      description
      state
      tags
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
      // An invalid enum value is rejected by GraphQL itself with a 400.
      validateStatus: () => true,
    },
  );

  return data;
}

// Novels cannot be deleted yet and tags are shared with the other specs' filters, so every run uses its own tag names.
const REQUEST_TAG = `
  mutation RequestTag($name: String!, $description: String!) {
    requestTag(input: { name: $name, description: $description }) { id }
  }
`;
const APPROVE_TAG = `
  mutation ApproveTag($id: ID!) {
    approveTag(id: $id) { id }
  }
`;

/**
 * @description Novels can only use approved tags, so each one goes through the request and the admin's approval first.
 */
async function approvedTag(label: string) {
  const name = `e2e-${label}-${randomUUID().slice(0, 8)}`;
  const writer =
    await AuthorizationFixture.getWriterAuthorizationHeader();
  const admin =
    await AuthorizationFixture.getAdminAuthorizationHeader();
  const requested = await graphql(
    REQUEST_TAG,
    { name, description: 'Tag for the management spec.' },
    writer,
  );

  await graphql(
    APPROVE_TAG,
    { id: requested.data.requestTag.id },
    admin,
  );

  return name;
}

describe('Novel management (e2e)', () => {
  const novelInput = {
    name: 'The Lantern Keeper',
    description: 'A lighthouse keeper finds a door in the fog.',
  };

  async function createNovelAsWriter(tags?: string[]) {
    const writer =
      await AuthorizationFixture.getWriterAuthorizationHeader();
    const data = await graphql(
      CREATE_NOVEL,
      { input: { ...novelInput, tags } },
      writer,
    );

    return data.data.createNovel as { id: string };
  }

  describe('createNovel', () => {
    it.each([
      {
        role: 'writer',
        penName: 'Writer_User',
        getAuthorizationHeader:
          AuthorizationFixture.getWriterAuthorizationHeader,
      },
      {
        role: 'admin',
        penName: 'Admin_User',
        getAuthorizationHeader:
          AuthorizationFixture.getAdminAuthorizationHeader,
      },
    ])(
      'should allow $role to create a novel, with defaults and tags',
      async ({ penName, getAuthorizationHeader }) => {
        const tag = await approvedTag('create');
        const authorization = await getAuthorizationHeader();

        const data = await graphql(
          CREATE_NOVEL,
          {
            input: {
              name: '  The Lantern Keeper  ',
              description:
                'A lighthouse keeper finds a door in the fog.',
              tags: [tag.toUpperCase(), tag],
            },
          },
          authorization,
        );

        expect(data.errors).toBeUndefined();
        expect(data.data.createNovel).toStrictEqual({
          id: expect.toBeString(),
          name: 'The Lantern Keeper',
          writer: { penName },
          description: 'A lighthouse keeper finds a door in the fog.',
          state: 'ONGOING',
          tags: [tag],
          allowedActions: ['MANAGE_TTS', 'EDIT_CONTENT'],
        });
      },
    );

    it('should make the writer the owner of the novel they create', async () => {
      const novel = await createNovelAsWriter();
      const writer =
        await AuthorizationFixture.getWriterAuthorizationHeader();
      const otherWriter =
        await AuthorizationFixture.getSecondWriterAuthorizationHeader();

      const asOwner = await graphql(
        UPDATE_NOVEL,
        { id: novel.id, input: { state: 'FINISHED' } },
        writer,
      );
      const asOtherWriter = await graphql(
        UPDATE_NOVEL,
        { id: novel.id, input: { state: 'ONGOING' } },
        otherWriter,
      );

      expect(asOwner.errors).toBeUndefined();
      expect(asOtherWriter.errors[0].message).toContain(
        'You do not have permission to update this novel',
      );
    });

    it('should NOT allow a plain user to create a novel', async () => {
      const user =
        await AuthorizationFixture.getUserAuthorizationHeader();

      const data = await graphql(
        CREATE_NOVEL,
        { input: novelInput },
        user,
      );

      expect(data.errors[0].message).toContain(
        'You do not have permission to create this novel',
      );
    });

    it.each([
      { field: 'name', value: '   ' },
      { field: 'tags', value: ['fantasy-ish', '  '] },
    ])(
      'should reject an invalid $field',
      async ({ field, value }) => {
        const writer =
          await AuthorizationFixture.getWriterAuthorizationHeader();

        const data = await graphql(
          CREATE_NOVEL,
          { input: { ...novelInput, [field]: value } },
          writer,
        );

        expect(data.errors).toBeArray();
        expect(data.data).toBeNull();
      },
    );
  });

  describe('updateNovel', () => {
    it.each([
      {
        role: 'owner',
        getAuthorizationHeader:
          AuthorizationFixture.getWriterAuthorizationHeader,
      },
      {
        role: 'admin',
        getAuthorizationHeader:
          AuthorizationFixture.getAdminAuthorizationHeader,
      },
    ])(
      'should allow the $role to update only the passed fields',
      async ({ getAuthorizationHeader }) => {
        const tag = await approvedTag('keep');
        const novel = await createNovelAsWriter([tag]);
        const authorization = await getAuthorizationHeader();

        const data = await graphql(
          UPDATE_NOVEL,
          {
            id: novel.id,
            input: { name: ' Renamed ', state: 'FINISHED' },
          },
          authorization,
        );

        expect(data.errors).toBeUndefined();
        expect(data.data.updateNovel).toStrictEqual({
          id: novel.id,
          name: 'Renamed',
          writer: { penName: 'Writer_User' },
          description: novelInput.description,
          state: 'FINISHED',
          tags: [tag],
        });
      },
    );

    it('should replace the tags when passed and clear them for an empty list', async () => {
      const before = await approvedTag('before');
      const after = await approvedTag('after');
      const novel = await createNovelAsWriter([before]);
      const writer =
        await AuthorizationFixture.getWriterAuthorizationHeader();

      const replaced = await graphql(
        UPDATE_NOVEL,
        { id: novel.id, input: { tags: [after] } },
        writer,
      );
      const cleared = await graphql(
        UPDATE_NOVEL,
        { id: novel.id, input: { tags: [] } },
        writer,
      );

      expect(replaced.data.updateNovel.tags).toStrictEqual([after]);
      expect(cleared.data.updateNovel.tags).toStrictEqual([]);
    });

    it.each([
      {
        role: 'user',
        getAuthorizationHeader:
          AuthorizationFixture.getUserAuthorizationHeader,
      },
      {
        role: 'writer who does not own the novel',
        getAuthorizationHeader:
          AuthorizationFixture.getSecondWriterAuthorizationHeader,
      },
    ])(
      'should NOT allow $role to update a novel',
      async ({ getAuthorizationHeader }) => {
        const novel = await createNovelAsWriter();
        const authorization = await getAuthorizationHeader();

        const data = await graphql(
          UPDATE_NOVEL,
          { id: novel.id, input: { name: 'Hijacked' } },
          authorization,
        );

        expect(data.errors[0].message).toContain(
          'You do not have permission to update this novel',
        );
      },
    );

    it('should return a not-found error for an unknown novel id', async () => {
      const admin =
        await AuthorizationFixture.getAdminAuthorizationHeader();

      const data = await graphql(
        UPDATE_NOVEL,
        { id: randomUUID(), input: { name: 'Ghost' } },
        admin,
      );

      expect(data.errors[0].message).toContain('not found');
    });

    it.each([
      { field: 'name', value: '   ' },
      { field: 'state', value: 'ABANDONED' },
    ])(
      'should reject an invalid $field',
      async ({ field, value }) => {
        const novel = await createNovelAsWriter();
        const writer =
          await AuthorizationFixture.getWriterAuthorizationHeader();

        const data = await graphql(
          UPDATE_NOVEL,
          { id: novel.id, input: { [field]: value } },
          writer,
        );

        expect(data.errors).toBeArray();
      },
    );
  });
});

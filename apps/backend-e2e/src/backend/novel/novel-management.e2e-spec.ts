import axios from 'axios';
import { randomUUID } from 'node:crypto';

import { AuthorizationFixture } from '../../support';

const CREATE_NOVEL = `#graphql
  mutation CreateNovel($input: CreateNovelInput!) {
    createNovel(input: $input) {
      id
      name
      author
      description
      state
      category
      allowedActions
    }
  }
`;

const UPDATE_NOVEL = `#graphql
  mutation UpdateNovel($id: ID!, $input: UpdateNovelInput!) {
    updateNovel(id: $id, input: $input) {
      id
      name
      author
      description
      state
      category
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

// Novels cannot be deleted yet and categories are shared with the other specs' filters, so every run uses its own category names.
function uniqueCategory(label: string) {
  return `e2e-${label}-${randomUUID().slice(0, 8)}`;
}

describe('Novel management (e2e)', () => {
  const novelInput = {
    name: 'The Lantern Keeper',
    author: 'Jane Doe',
    description: 'A lighthouse keeper finds a door in the fog.',
  };

  async function createNovelAsWriter(categories?: string[]) {
    const writer =
      await AuthorizationFixture.getWriterAuthorizationHeader();
    const data = await graphql(
      CREATE_NOVEL,
      { input: { ...novelInput, categories } },
      writer,
    );

    return data.data.createNovel as { id: string };
  }

  describe('createNovel', () => {
    it.each([
      {
        role: 'writer',
        getAuthorizationHeader:
          AuthorizationFixture.getWriterAuthorizationHeader,
      },
      {
        role: 'admin',
        getAuthorizationHeader:
          AuthorizationFixture.getAdminAuthorizationHeader,
      },
    ])(
      'should allow $role to create a novel, with defaults and categories',
      async ({ getAuthorizationHeader }) => {
        const category = uniqueCategory('create');
        const authorization = await getAuthorizationHeader();

        const data = await graphql(
          CREATE_NOVEL,
          {
            input: {
              name: '  The Lantern Keeper  ',
              author: 'Jane Doe',
              description:
                'A lighthouse keeper finds a door in the fog.',
              categories: [category.toUpperCase(), category],
            },
          },
          authorization,
        );

        expect(data.errors).toBeUndefined();
        expect(data.data.createNovel).toStrictEqual({
          id: expect.toBeString(),
          name: 'The Lantern Keeper',
          author: 'Jane Doe',
          description: 'A lighthouse keeper finds a door in the fog.',
          state: 'ONGOING',
          category: [category],
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
      { field: 'author', value: '' },
      { field: 'categories', value: ['fantasy-ish', '  '] },
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
        const category = uniqueCategory('keep');
        const novel = await createNovelAsWriter([category]);
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
          author: novelInput.author,
          description: novelInput.description,
          state: 'FINISHED',
          category: [category],
        });
      },
    );

    it('should replace the categories when passed and clear them for an empty list', async () => {
      const before = uniqueCategory('before');
      const after = uniqueCategory('after');
      const novel = await createNovelAsWriter([before]);
      const writer =
        await AuthorizationFixture.getWriterAuthorizationHeader();

      const replaced = await graphql(
        UPDATE_NOVEL,
        { id: novel.id, input: { categories: [after] } },
        writer,
      );
      const cleared = await graphql(
        UPDATE_NOVEL,
        { id: novel.id, input: { categories: [] } },
        writer,
      );

      expect(replaced.data.updateNovel.category).toStrictEqual([
        after,
      ]);
      expect(cleared.data.updateNovel.category).toStrictEqual([]);
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

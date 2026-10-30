import axios from 'axios';
import { randomUUID } from 'node:crypto';

import { AuthorizationFixture } from '../support';

const CATEGORIES = `#graphql
  query Categories($first: Int, $after: String, $filters: CategoryFiltersInput) {
    categoriesConnection(first: $first, after: $after, filters: $filters) {
      edges {
        cursor
        node {
          id
          name
          status
        }
      }
      pageInfo {
        startCursor
        endCursor
        hasNextPage
        hasPreviousPage
      }
    }
  }
`;

async function categories(
  variables: Record<string, unknown>,
  authorization?: string,
) {
  const { data } = await axios.post(
    '/graphql',
    { query: CATEGORIES, variables },
    {
      headers: authorization ? { Authorization: authorization } : {},
      validateStatus: () => true,
    },
  );

  return data;
}

describe('Categories (e2e)', () => {
  it('should page through the approved categories in name order with cursors', async () => {
    const firstPage = await categories({ first: 1 });
    const { endCursor } =
      firstPage.data.categoriesConnection.pageInfo;

    const secondPage = await categories({
      first: 1,
      after: endCursor,
    });

    const names = [
      ...firstPage.data.categoriesConnection.edges,
      ...secondPage.data.categoriesConnection.edges,
    ].map(({ node }) => node.name);
    expect(firstPage.errors).toBeUndefined();
    expect(firstPage.data.categoriesConnection.edges).toHaveLength(1);
    expect(
      firstPage.data.categoriesConnection.pageInfo,
    ).toMatchObject({ hasNextPage: true, hasPreviousPage: false });
    expect(
      secondPage.data.categoriesConnection.pageInfo,
    ).toMatchObject({ hasPreviousPage: true });
    expect(names).toEqual([...names].sort());
    expect(new Set(names).size).toBe(names.length);
  });

  it('should search the name case-insensitively', async () => {
    const data = await categories({
      first: 10,
      filters: { search: 'FANT' },
    });

    const nodes = data.data.categoriesConnection.edges.map(
      ({ node }: { node: { name: string } }) => node,
    );
    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes).toSatisfyAll(({ name }) => name.includes('fant'));
  });

  it.each(['%', '_', '\\'])(
    'should treat %s in the search as plain text, not a wildcard',
    async (search) => {
      const data = await categories({
        first: 10,
        filters: { search },
      });

      expect(data.errors).toBeUndefined();
      expect(data.data.categoriesConnection.edges).toBeEmpty();
    },
  );

  it('should answer a malformed cursor with a bad request, not an internal error', async () => {
    const data = await categories({
      first: 1,
      after: 'not-base64!!',
    });

    expect(data.errors[0].message).toBe('Invalid cursor');
    expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
  });

  it('should return a page of 20 at most when no size is given', async () => {
    const data = await categories({});

    expect(
      data.data.categoriesConnection.edges.length,
    ).toBeLessThanOrEqual(20);
  });

  it.each([{ first: 0 }, { first: 101 }])(
    'should reject $first as the page size',
    async (variables) => {
      const data = await categories(variables);

      expect(data.errors[0].message).toContain('first and last');
    },
  );

  it.each([
    {
      caller: 'anonymous',
      getAuthorizationHeader: async () => undefined,
    },
    {
      caller: 'a writer',
      getAuthorizationHeader:
        AuthorizationFixture.getWriterAuthorizationHeader,
    },
    {
      caller: 'an admin',
      getAuthorizationHeader:
        AuthorizationFixture.getAdminAuthorizationHeader,
    },
  ])(
    'should let $caller ask for PENDING without breaking the query',
    async ({ getAuthorizationHeader }) => {
      const authorization = await getAuthorizationHeader();

      const data = await categories(
        { first: 5, filters: { status: 'PENDING' } },
        authorization,
      );

      expect(data.errors).toBeUndefined();
      expect(data.data.categoriesConnection.edges).toBeArray();
    },
  );
});

const REQUEST_CATEGORY = `#graphql
  mutation RequestCategory($name: String!) {
    requestCategory(name: $name) { id name status }
  }
`;
const APPROVE_CATEGORY = `#graphql
  mutation ApproveCategory($id: ID!) {
    approveCategory(id: $id) { id name status }
  }
`;
const UPDATE_CATEGORY = `#graphql
  mutation UpdateCategory($id: ID!, $name: String!) {
    updateCategory(id: $id, name: $name) { id name status }
  }
`;
const DELETE_CATEGORY = `#graphql
  mutation DeleteCategory($id: ID!) {
    deleteCategory(id: $id) { id }
  }
`;
const CREATE_NOVEL = `#graphql
  mutation CreateNovel($input: CreateNovelInput!) {
    createNovel(input: $input) { id category }
  }
`;
const NOVEL_CATEGORIES = `#graphql
  query NovelCategories($id: ID!) {
    novel(id: $id) { id category }
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

describe('Category requests and management (e2e)', () => {
  const uniqueName = (prefix: string) =>
    `e2e-${prefix}-${randomUUID().slice(0, 8)}`;
  const unknownId = '0f5e3a9c-7b21-4c68-8d14-62e9a1b0c3d7';
  let writer: string;
  let admin: string;
  let user: string;

  beforeAll(async () => {
    writer =
      await AuthorizationFixture.getWriterAuthorizationHeader();
    admin = await AuthorizationFixture.getAdminAuthorizationHeader();
    user = await AuthorizationFixture.getUserAuthorizationHeader();
  });

  async function requestAsWriter(name: string) {
    const data = await graphql(REQUEST_CATEGORY, { name }, writer);

    return data.data.requestCategory as { id: string; name: string };
  }

  async function pendingNames(authorization?: string) {
    const data = await categories(
      { first: 100, filters: { status: 'PENDING', search: 'e2e-' } },
      authorization,
    );

    return data.data.categoriesConnection.edges.map(
      ({ node }: { node: { name: string } }) => node.name,
    );
  }

  describe('requestCategory', () => {
    it.each([
      { caller: 'a writer', header: () => writer },
      { caller: 'an admin', header: () => admin },
    ])(
      'should let $caller request a category, normalized and PENDING',
      async ({ header }) => {
        const name = uniqueName('request');

        const data = await graphql(
          REQUEST_CATEGORY,
          { name: `  ${name.toUpperCase()} ` },
          header(),
        );

        expect(data.errors).toBeUndefined();
        expect(data.data.requestCategory).toStrictEqual({
          id: expect.toBeString(),
          name,
          status: 'PENDING',
        });
      },
    );

    it('should NOT let a plain user request a category', async () => {
      const data = await graphql(
        REQUEST_CATEGORY,
        { name: uniqueName('user') },
        user,
      );

      expect(data.errors[0].message).toContain(
        'You need at least the "writer" role',
      );
    });

    it('should NOT let an anonymous caller request a category', async () => {
      const data = await graphql(REQUEST_CATEGORY, {
        name: uniqueName('anonymous'),
      });

      expect(data.errors[0].message).toContain(
        'Missing Bearer token',
      );
    });

    it.each(['fantasy', 'FANTASY'])(
      'should answer 400 with the normalized name when asking for the existing %s',
      async (name) => {
        const data = await graphql(
          REQUEST_CATEGORY,
          { name },
          writer,
        );

        expect(data.errors[0].message).toContain('"fantasy"');
        expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
      },
    );

    it('should answer 400 with the normalized name when the request is already pending', async () => {
      const name = uniqueName('twice');
      await requestAsWriter(name);

      const data = await graphql(
        REQUEST_CATEGORY,
        { name: name.toUpperCase() },
        writer,
      );

      expect(data.errors[0].message).toContain(`"${name}"`);
    });

    it('should reject a name longer than 50 characters', async () => {
      const data = await graphql(
        REQUEST_CATEGORY,
        { name: 'a'.repeat(51) },
        writer,
      );

      expect(data.errors[0].message).toContain(
        'at most 50 characters',
      );
    });

    it('should reject an empty name', async () => {
      const data = await graphql(
        REQUEST_CATEGORY,
        { name: '   ' },
        writer,
      );

      expect(data.errors[0].message).toContain('cannot be empty');
    });
  });

  describe('pending categories', () => {
    it('should show a pending category to the admin only', async () => {
      const name = uniqueName('visible');
      await requestAsWriter(name);

      const asAdmin = await pendingNames(admin);
      const asWriter = await pendingNames(writer);
      const asAnonymous = await pendingNames();

      expect(asAdmin).toContain(name);
      expect(asWriter).not.toContain(name);
      expect(asAnonymous).not.toContain(name);
    });

    it('should NOT allow a novel to use it until an admin approves it', async () => {
      const { id, name } = await requestAsWriter(uniqueName('novel'));
      const input = {
        name: 'The Lantern Keeper',
        description: 'A lighthouse keeper finds a door in the fog.',
        categories: [name],
      };

      const before = await graphql(CREATE_NOVEL, { input }, writer);
      await graphql(APPROVE_CATEGORY, { id }, admin);
      const after = await graphql(CREATE_NOVEL, { input }, writer);

      expect(before.errors[0].message).toContain(
        `These categories are not available: ${name}`,
      );
      expect(after.errors).toBeUndefined();
      expect(after.data.createNovel.category).toEqual([name]);
    });
  });

  describe('approveCategory, updateCategory and deleteCategory', () => {
    it.each([
      {
        name: 'approve',
        query: APPROVE_CATEGORY,
        variables: { id: unknownId },
      },
      {
        name: 'rename',
        query: UPDATE_CATEGORY,
        variables: { id: unknownId, name: 'x' },
      },
      {
        name: 'delete',
        query: DELETE_CATEGORY,
        variables: { id: unknownId },
      },
    ])(
      'should NOT let a writer $name a category',
      async ({ query, variables }) => {
        const data = await graphql(query, variables, writer);

        expect(data.errors[0].message).toContain(
          'You need at least the "admin" role',
        );
      },
    );

    it.each([
      {
        name: 'approve',
        query: APPROVE_CATEGORY,
        variables: { id: unknownId },
      },
      {
        name: 'rename',
        query: UPDATE_CATEGORY,
        variables: { id: unknownId, name: 'x' },
      },
      {
        name: 'delete',
        query: DELETE_CATEGORY,
        variables: { id: unknownId },
      },
    ])(
      'should answer 404 when the admin tries to $name an unknown category',
      async ({ query, variables }) => {
        const data = await graphql(query, variables, admin);

        expect(data.errors[0].message).toBe('Category not found');
      },
    );

    it('should approve a pending category, and again without a change', async () => {
      const { id, name } = await requestAsWriter(
        uniqueName('approve'),
      );

      const first = await graphql(APPROVE_CATEGORY, { id }, admin);
      const second = await graphql(APPROVE_CATEGORY, { id }, admin);

      expect(first.data.approveCategory).toStrictEqual({
        id,
        name,
        status: 'APPROVED',
      });
      expect(second.data.approveCategory).toStrictEqual(
        first.data.approveCategory,
      );
    });

    it('should rename a category, normalized, and the novels follow', async () => {
      const { id, name } = await requestAsWriter(
        uniqueName('rename'),
      );
      await graphql(APPROVE_CATEGORY, { id }, admin);
      const novel = await graphql(
        CREATE_NOVEL,
        {
          input: {
            name: 'The Lantern Keeper',
            description:
              'A lighthouse keeper finds a door in the fog.',
            categories: [name],
          },
        },
        writer,
      );
      const renamed = uniqueName('renamed');

      const data = await graphql(
        UPDATE_CATEGORY,
        { id, name: `  ${renamed.toUpperCase()} ` },
        admin,
      );
      const read = await graphql(NOVEL_CATEGORIES, {
        id: novel.data.createNovel.id,
      });

      expect(data.data.updateCategory).toStrictEqual({
        id,
        name: renamed,
        status: 'APPROVED',
      });
      expect(read.data.novel.category).toEqual([renamed]);
    });

    it('should answer 400 with the normalized name when renaming to an existing one', async () => {
      const { id } = await requestAsWriter(uniqueName('clash'));

      const data = await graphql(
        UPDATE_CATEGORY,
        { id, name: 'FANTASY' },
        admin,
      );

      expect(data.errors[0].message).toContain('"fantasy"');
      expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
    });

    it('should delete an approved category from its novels and keep the novels', async () => {
      const { id, name } = await requestAsWriter(
        uniqueName('delete'),
      );
      await graphql(APPROVE_CATEGORY, { id }, admin);
      const novel = await graphql(
        CREATE_NOVEL,
        {
          input: {
            name: 'The Lantern Keeper',
            description:
              'A lighthouse keeper finds a door in the fog.',
            categories: [name, 'fantasy'],
          },
        },
        writer,
      );

      const data = await graphql(DELETE_CATEGORY, { id }, admin);
      const read = await graphql(NOVEL_CATEGORIES, {
        id: novel.data.createNovel.id,
      });

      expect(data.data.deleteCategory).toStrictEqual({ id });
      expect(read.data.novel.category).toEqual(['fantasy']);
    });

    it('should reject a pending request by deleting it', async () => {
      const { id, name } = await requestAsWriter(
        uniqueName('reject'),
      );

      await graphql(DELETE_CATEGORY, { id }, admin);

      expect(await pendingNames(admin)).not.toContain(name);
    });
  });
});

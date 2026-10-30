import axios from 'axios';

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

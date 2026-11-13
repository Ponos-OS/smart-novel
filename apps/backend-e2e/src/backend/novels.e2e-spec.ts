import axios from 'axios';

const NOVELS = `#graphql
  query Novels($first: Int, $after: Cursor, $where: NovelWhereInput) {
    novels(first: $first, after: $after, where: $where) {
      edges {
        cursor
        node {
          id
          name
          state
          writer {
            penName
          }
          tags {
            name
          }
        }
      }
      pageInfo {
        endCursor
        startCursor
        hasNextPage
        hasPreviousPage
      }
    }
  }
`;

async function novels(variables: Record<string, unknown> = {}) {
  const { status, data } = await axios.post('/graphql', {
    query: NOVELS,
    variables,
  });

  return { status, ...data };
}

describe('Novels (e2e)', () => {
  it('should return a list of novels', async () => {
    const res = await novels();

    expect(res.status).toBe(200);
    expect(res.errors).toBeUndefined();
    expect(res.data.novels.edges.length).toBeGreaterThan(0);
    expect(res.data.novels.pageInfo.endCursor).toBeString();
    expect(res.data.novels.pageInfo.startCursor).toBeString();
    expect(res.data.novels.pageInfo.hasNextPage).toBeBoolean();
    expect(res.data.novels.pageInfo.hasPreviousPage).toBeBoolean();
    expect(res.data.novels.edges[0].cursor).toBeString();
    expect(res.data.novels.edges[0].node).toHaveProperty('id');
    expect(res.data.novels.edges[0].node).toHaveProperty('name');
    expect(res.data.novels.edges[0].node).toHaveProperty('state');
    expect(res.data.novels.edges[0].node).toHaveProperty('writer');
    expect(res.data.novels.edges[0].node).toHaveProperty('tags');
  });

  it('should return first two novels', async () => {
    const res = await novels({ first: 2 });

    expect(res.errors).toBeUndefined();
    expect(res.data.novels.edges.length).toBeLessThanOrEqual(2);
  });

  it('should return novels after a cursor', async () => {
    const firstPage = await novels({ first: 1 });
    const { endCursor } = firstPage.data.novels.pageInfo;

    const res = await novels({ first: 1, after: endCursor });

    expect(res.errors).toBeUndefined();
    expect(res.data.novels.pageInfo.hasPreviousPage).toBeTrue();
    expect(res.data.novels.edges[0]?.node.id).not.toBe(
      firstPage.data.novels.edges[0].node.id,
    );
  });

  it('should filter novels by tag', async () => {
    const res = await novels({
      where: {
        hasTagsWith: [{ nameIn: ['fantasy'] }],
        not: { hasTagsWith: [{ nameIn: ['adventure'] }] },
      },
    });

    expect(res.errors).toBeUndefined();
    for (const { node } of res.data.novels.edges) {
      const names = node.tags.map(
        ({ name }: { name: string }) => name,
      );
      expect(names).toContain('fantasy');
      expect(names).not.toContain('adventure');
    }
  });

  it('should treat tag values as canonical (case-insensitive)', async () => {
    const res = await novels({
      where: { hasTagsWith: [{ nameIn: ['Fantasy'] }] },
    });

    expect(res.errors).toBeUndefined();
    expect(
      res.data.novels.edges[0].node.tags.map(
        ({ name }: { name: string }) => name,
      ),
    ).toContain('fantasy');
  });
});

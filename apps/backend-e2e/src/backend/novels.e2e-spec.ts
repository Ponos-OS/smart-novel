import axios from 'axios';

describe('Novels (e2e)', () => {
  it('should return a list of novels', async () => {
    const res = await axios.post('/graphql', {
      query: `#graphql
        query {
          novelsConnection {
            edges {
              cursor
              node {
                id
                name
                state
                writer {
                  penName
                }
                tags
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
      `,
    });

    expect(res.status).toBe(200);
    expect(
      res.data.data.novelsConnection.edges.length,
    ).toBeGreaterThan(0);
    expect(
      res.data.data.novelsConnection.pageInfo.endCursor,
    ).toBeString();
    expect(
      res.data.data.novelsConnection.pageInfo.startCursor,
    ).toBeString();
    expect(
      res.data.data.novelsConnection.pageInfo.hasNextPage,
    ).toBeBoolean();
    expect(
      res.data.data.novelsConnection.pageInfo.hasPreviousPage,
    ).toBeBoolean();
    expect(
      res.data.data.novelsConnection.edges[0].cursor,
    ).toBeString();
    expect(
      res.data.data.novelsConnection.edges[0].node,
    ).toHaveProperty('id');
    expect(
      res.data.data.novelsConnection.edges[0].node,
    ).toHaveProperty('name');
    expect(
      res.data.data.novelsConnection.edges[0].node,
    ).toHaveProperty('state');
    expect(
      res.data.data.novelsConnection.edges[0].node,
    ).toHaveProperty('writer');
    expect(
      res.data.data.novelsConnection.edges[0].node,
    ).toHaveProperty('tags');
  });

  it('should return first two novels', async () => {
    const res = await axios.post('/graphql', {
      query: `#graphql
        query {
          novelsConnection(first: 2) {
            edges {
              cursor
            }
            pageInfo {
              endCursor
              startCursor
              hasNextPage
              hasPreviousPage
            }
          }
        }
      `,
    });

    expect(res.status).toBe(200);
  });

  it('should return novels after a cursor', async () => {
    const res = await axios.post('/graphql', {
      query: `#graphql
        query {
          novelsConnection(first: 1, after: "ZXhhbXBsZS1ub3ZlbA==") {
            edges {
              cursor
            }
            pageInfo {
              endCursor
            }
          }
        }
      `,
    });

    expect(res.status).toBe(200);
  });

  it('should filter novels by tag', async () => {
    const res = await axios.post('/graphql', {
      query: `#graphql
        query {
          novelsConnection(filters: { tags: { in: ["fantasy"], nin: ["adventure"] } }) {
            edges {
              node {
                tags
              }
            }
          }
        }
      `,
    });

    expect(res.status).toBe(200);
  });

  it('should treat tag values as canonical (case-insensitive)', async () => {
    const res = await axios.post('/graphql', {
      query: `#graphql
        query {
          novelsConnection(filters: { tags: { in: ["Fantasy"] } }) {
            edges {
              node {
                tags
              }
            }
          }
        }
      `,
    });

    expect(res.status).toBe(200);
    expect(
      res.data.data.novelsConnection.edges[0].node.tags,
    ).toContain('fantasy');
  });
});

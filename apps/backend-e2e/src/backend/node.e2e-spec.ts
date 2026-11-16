import { randomUUID } from 'node:crypto';

import { AuthorizationFixture, graphql } from '../support';

const NODE = `#graphql
  query Node($id: ID!) {
    node(id: $id) {
      __typename
      id
    }
  }
`;
const NODES = `#graphql
  query Nodes($ids: [ID!]!) {
    nodes(ids: $ids) {
      __typename
      id
    }
  }
`;
const WRITER_EMAIL = `#graphql
  query WriterEmail($id: ID!) {
    node(id: $id) {
      ... on Writer {
        email
      }
    }
  }
`;

describe('Global Object Identification (e2e)', () => {
  const NOVEL_ID = 'c1d31ec2-f478-4648-b90b-d1e53de2a829'; // example-novel from the seed data
  const CHAPTER_ID = '4769a024-6267-4abc-a412-5ab0241a8d0e'; // its second chapter
  let user: string;
  let seededWriter: string;
  let writer: string;
  let admin: string;
  let writerId: string;
  let draftId: string;
  let pendingTagId: string;
  let snapshotId: string;

  async function nodeOf(id: string, authorization?: string) {
    const data = await graphql(NODE, { id }, authorization);

    expect(data.errors).toBeUndefined();

    return data.data.node;
  }

  beforeAll(async () => {
    user = await AuthorizationFixture.getUserAuthorizationHeader();
    seededWriter =
      await AuthorizationFixture.getWriterAuthorizationHeader();
    writer = await AuthorizationFixture.getWriterAuthorizationHeader({
      fresh: true,
    });
    admin = await AuthorizationFixture.getAdminAuthorizationHeader();

    writerId = (
      await graphql(
        `
          #graphql
          query MyWriter {
            myWriter {
              id
            }
          }
        `,
        {},
        writer,
      )
    ).data.myWriter.id;
    draftId = (
      await graphql(
        `
          #graphql
          mutation CreateLicenseDraft(
            $input: CreateLicenseDraftInput!
          ) {
            createLicenseDraft(input: $input) {
              id
            }
          }
        `,
        { input: {} },
        writer,
      )
    ).data.createLicenseDraft.id;
    pendingTagId = (
      await graphql(
        `
          #graphql
          mutation RequestTag($name: String!, $description: String!) {
            requestTag(
              input: { name: $name, description: $description }
            ) {
              id
            }
          }
        `,
        {
          name: `e2e-node-${randomUUID().slice(0, 8)}`,
          description:
            'A tag only an admin may see, for the e2e specs.',
        },
        writer,
      )
    ).data.requestTag.id;
    snapshotId = (
      await graphql(
        `
          #graphql
          query Snapshots {
            statsSnapshots(first: 1) {
              edges {
                node {
                  id
                }
              }
            }
          }
        `,
        {},
        admin,
      )
    ).data.statsSnapshots.edges[0].node.id;
  });

  it('should refuse an anonymous caller', async () => {
    const data = await graphql(NODE, { id: NOVEL_ID });

    expect(data.errors[0].extensions.code).toBe('UNAUTHENTICATED');
  });

  it.each([
    ['a novel', () => NOVEL_ID, 'Novel'],
    ['a chapter', () => CHAPTER_ID, 'Chapter'],
  ])(
    'should give %s to any signed in user',
    async (_name, id, typename) => {
      const found = await nodeOf(id(), user);

      expect(found).toStrictEqual({ __typename: typename, id: id() });
    },
  );

  it('should answer null, without an error, for an ID nothing has', async () => {
    const found = await nodeOf(randomUUID(), user);

    expect(found).toBeNull();
  });

  it('should keep the order of the IDs in nodes, with null for what is unknown', async () => {
    const unknown = randomUUID();

    const data = await graphql(
      NODES,
      { ids: [CHAPTER_ID, unknown, NOVEL_ID, CHAPTER_ID] },
      user,
    );

    expect(data.errors).toBeUndefined();
    expect(data.data.nodes).toStrictEqual([
      { __typename: 'Chapter', id: CHAPTER_ID },
      null,
      { __typename: 'Novel', id: NOVEL_ID },
      { __typename: 'Chapter', id: CHAPTER_ID },
    ]);
  });

  it('should refuse more IDs than a list may hold', async () => {
    const ids = Array.from({ length: 101 }, () => randomUUID());

    const data = await graphql(NODES, { ids }, user);

    expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
  });

  describe.each([
    [
      'a license draft',
      () => draftId,
      'License',
      'writer',
      'seeded writer',
    ],
    ['a pending tag', () => pendingTagId, 'Tag', 'admin', 'writer'],
    ['a writer', () => writerId, 'Writer', 'writer', 'seeded writer'],
    [
      'a statistics snapshot',
      () => snapshotId,
      'StatsSnapshot',
      'admin',
      'writer',
    ],
  ])('%s', (_name, id, typename, allowed, refused) => {
    const headers: Record<string, () => string> = {
      admin: () => admin,
      writer: () => writer,
      'seeded writer': () => seededWriter,
    };

    it(`should be given to ${allowed}`, async () => {
      const found = await nodeOf(id(), headers[allowed]());

      expect(found).toStrictEqual({ __typename: typename, id: id() });
    });

    it(`should be hidden from ${refused}, as if it did not exist`, async () => {
      const found = await nodeOf(id(), headers[refused]());

      expect(found).toBeNull();
    });

    it('should be hidden from a plain user', async () => {
      const found = await nodeOf(id(), user);

      expect(found).toBeNull();
    });
  });

  it('should give a draft and a writer to an admin too, with the email of the writer', async () => {
    const draft = await nodeOf(draftId, admin);
    const data = await graphql(WRITER_EMAIL, { id: writerId }, admin);

    expect(draft.__typename).toBe('License');
    expect(data.data.node.email).toBeString();
  });
});

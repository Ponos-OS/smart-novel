import axios from 'axios';
import { randomUUID } from 'node:crypto';

import {
  AuthorizationFixture,
  ClusterFixture,
  config,
} from '../support';

const TAGS = `#graphql
  query Tags($first: Int, $after: String, $filters: TagFiltersInput) {
    tagsConnection(first: $first, after: $after, filters: $filters) {
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

async function tags(
  variables: Record<string, unknown>,
  authorization?: string,
) {
  const { data } = await axios.post(
    '/graphql',
    { query: TAGS, variables },
    {
      headers: authorization ? { Authorization: authorization } : {},
      validateStatus: () => true,
    },
  );

  return data;
}

describe('Tags (e2e)', () => {
  it('should page through the approved tags in name order with cursors', async () => {
    const firstPage = await tags({ first: 1 });
    const { endCursor } = firstPage.data.tagsConnection.pageInfo;

    const secondPage = await tags({
      first: 1,
      after: endCursor,
    });

    const names = [
      ...firstPage.data.tagsConnection.edges,
      ...secondPage.data.tagsConnection.edges,
    ].map(({ node }) => node.name);
    expect(firstPage.errors).toBeUndefined();
    expect(firstPage.data.tagsConnection.edges).toHaveLength(1);
    expect(firstPage.data.tagsConnection.pageInfo).toMatchObject({
      hasNextPage: true,
      hasPreviousPage: false,
    });
    expect(secondPage.data.tagsConnection.pageInfo).toMatchObject({
      hasPreviousPage: true,
    });
    expect(names).toEqual([...names].sort());
    expect(new Set(names).size).toBe(names.length);
  });

  it('should find the tags whose name starts with the text, case-insensitively', async () => {
    const data = await tags({
      first: 10,
      filters: { search: 'FANT' },
    });

    const nodes = data.data.tagsConnection.edges.map(
      ({ node }: { node: { name: string } }) => node,
    );
    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes).toSatisfyAll(({ name }) => name.startsWith('fant'));
  });

  it('should not find a tag by a part from the middle of its name', async () => {
    const data = await tags({
      first: 10,
      filters: { search: 'ntas' },
    });

    expect(data.data.tagsConnection.edges).toBeEmpty();
  });

  it.each(['%', '_', '\\'])(
    'should treat %s in the search as plain text, not a wildcard',
    async (search) => {
      const data = await tags({
        first: 10,
        filters: { search },
      });

      expect(data.errors).toBeUndefined();
      expect(data.data.tagsConnection.edges).toBeEmpty();
    },
  );

  it('should answer a malformed cursor with a bad request, not an internal error', async () => {
    const data = await tags({
      first: 1,
      after: 'not-base64!!',
    });

    expect(data.errors[0].message).toBe('Invalid cursor');
    expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
  });

  it('should return a page of 20 at most when no size is given', async () => {
    const data = await tags({});

    expect(data.data.tagsConnection.edges.length).toBeLessThanOrEqual(
      20,
    );
  });

  it.each([{ first: 0 }, { first: 101 }])(
    'should reject $first as the page size',
    async (variables) => {
      const data = await tags(variables);

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

      const data = await tags(
        { first: 5, filters: { statuses: ['PENDING'] } },
        authorization,
      );

      expect(data.errors).toBeUndefined();
      expect(data.data.tagsConnection.edges).toBeArray();
    },
  );
});

const REQUEST_TAG = `#graphql
  mutation RequestTag($name: String!, $description: String!) {
    requestTag(input: { name: $name, description: $description }) { id name description status }
  }
`;
const CREATE_TAG = `#graphql
  mutation CreateTag($name: String!, $description: String!) {
    createTag(input: { name: $name, description: $description }) { id name description status }
  }
`;
const APPROVE_TAG = `#graphql
  mutation ApproveTag($id: ID!) {
    approveTag(id: $id) { id name status }
  }
`;
const UPDATE_TAG = `#graphql
  mutation UpdateTag($id: ID!, $name: String, $description: String) {
    updateTag(id: $id, input: { name: $name, description: $description }) { id name description status }
  }
`;
const TAG_DESCRIPTION = `#graphql
  query TagDescription($search: String) {
    tagsConnection(filters: { search: $search }) {
      edges { node { id description } }
    }
  }
`;
const DELETE_TAG = `#graphql
  mutation DeleteTag($id: ID!) {
    deleteTag(id: $id) { id }
  }
`;
const CREATE_NOVEL = `#graphql
  mutation CreateNovel($input: CreateNovelInput!) {
    createNovel(input: $input) { id tag }
  }
`;
const NOVEL_TAGS = `#graphql
  query NovelTags($id: ID!) {
    novel(id: $id) { id tag }
  }
`;

const DESCRIPTION = 'Stories of this kind, for the e2e specs.';

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

describe('Tag requests and management (e2e)', () => {
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
    const data = await graphql(
      REQUEST_TAG,
      { name, description: DESCRIPTION },
      writer,
    );

    return data.data.requestTag as { id: string; name: string };
  }

  async function pendingNames(authorization?: string) {
    const data = await tags(
      {
        first: 100,
        filters: { statuses: ['PENDING'], search: 'e2e-' },
      },
      authorization,
    );

    return data.data.tagsConnection.edges.map(
      ({ node }: { node: { name: string } }) => node.name,
    );
  }

  describe('requestTag', () => {
    it.each([
      { caller: 'a writer', header: () => writer },
      { caller: 'an admin', header: () => admin },
    ])(
      'should let $caller request a tag, trimmed and PENDING',
      async ({ header }) => {
        const name = uniqueName('request');

        const data = await graphql(
          REQUEST_TAG,
          {
            name: `  ${name} `,
            description: `  ${DESCRIPTION}  `,
          },
          header(),
        );

        expect(data.errors).toBeUndefined();
        expect(data.data.requestTag).toStrictEqual({
          id: expect.toBeString(),
          name,
          description: DESCRIPTION,
          status: 'PENDING',
        });
      },
    );

    it('should NOT let a plain user request a tag', async () => {
      const data = await graphql(
        REQUEST_TAG,
        { name: uniqueName('user'), description: DESCRIPTION },
        user,
      );

      expect(data.errors[0].message).toContain(
        'You need at least the "writer" role',
      );
    });

    it('should NOT let an anonymous caller request a tag', async () => {
      const data = await graphql(REQUEST_TAG, {
        name: uniqueName('anonymous'),
        description: DESCRIPTION,
      });

      expect(data.errors[0].message).toContain(
        'Missing Bearer token',
      );
    });

    it.each(['fantasy', 'FANTASY'])(
      'should answer 400 naming the tag when asking for the existing %s',
      async (name) => {
        const data = await graphql(
          REQUEST_TAG,
          { name, description: DESCRIPTION },
          writer,
        );

        expect(data.errors[0].message).toContain(`"${name}"`);
        expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
      },
    );

    it('should answer 400 naming the tag when the request is already pending', async () => {
      const name = uniqueName('twice');
      await requestAsWriter(name);

      const data = await graphql(
        REQUEST_TAG,
        { name: name.toUpperCase(), description: DESCRIPTION },
        writer,
      );

      expect(data.errors[0].message).toContain(
        `"${name.toUpperCase()}"`,
      );
    });

    it('should reject a name longer than 50 characters', async () => {
      const data = await graphql(
        REQUEST_TAG,
        { name: 'a'.repeat(51), description: DESCRIPTION },
        writer,
      );

      expect(data.errors[0].message).toContain(
        'at most 50 characters',
      );
    });

    it.each([
      {
        scenario: 'empty',
        description: '   ',
        message: 'needs a description',
      },
      {
        scenario: 'longer than 650 characters',
        description: 'a'.repeat(651),
        message: 'at most 650 characters',
      },
    ])(
      'should reject a description that is $scenario',
      async ({ description, message }) => {
        const data = await graphql(
          REQUEST_TAG,
          { name: uniqueName('bad-description'), description },
          writer,
        );

        expect(data.errors[0].message).toContain(message);
        expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
      },
    );

    it('should reject an empty name', async () => {
      const data = await graphql(
        REQUEST_TAG,
        { name: '   ', description: DESCRIPTION },
        writer,
      );

      expect(data.errors[0].message).toContain('cannot be empty');
    });
  });

  describe('searching the names', () => {
    it('should find a tag by the start of any of its words, but not by a part from the middle', async () => {
      const token = `zebra${randomUUID().replace(/-/g, '').slice(0, 8)}`;
      const spaced = await requestAsWriter(`e2e-alpha ${token}`);
      const hyphenated = await requestAsWriter(`e2e-beta-${token}`);
      await graphql(APPROVE_TAG, { id: spaced.id }, admin);
      await graphql(APPROVE_TAG, { id: hyphenated.id }, admin);

      const byWord = await tags({
        first: 10,
        filters: { search: token.toUpperCase() },
      });
      const byMiddle = await tags({
        first: 10,
        filters: { search: token.slice(1) },
      });

      expect(
        byWord.data.tagsConnection.edges
          .map(({ node }: { node: { name: string } }) => node.name)
          .sort(),
      ).toEqual([`e2e-alpha ${token}`, `e2e-beta-${token}`]);
      expect(byMiddle.data.tagsConnection.edges).toBeEmpty();
    });
  });

  describe('pending tags', () => {
    it('should show a pending tag to the admin only', async () => {
      const name = uniqueName('visible');
      await requestAsWriter(name);

      const asAdmin = await pendingNames(admin);
      const asWriter = await pendingNames(writer);
      const asAnonymous = await pendingNames();

      expect(asAdmin).toContain(name);
      expect(asWriter).not.toContain(name);
      expect(asAnonymous).not.toContain(name);
    });

    it('should list approved and pending tags together for the admin, and the requester only to the admin', async () => {
      const name = uniqueName('both');
      await requestAsWriter(name);
      const query = `#graphql
        query Both($filters: TagFiltersInput) {
          tagsConnection(first: 100, filters: $filters) {
            edges { node { name status requesterUserId } }
          }
        }
      `;
      const filters = {
        statuses: ['APPROVED', 'PENDING'],
        search: 'e2e-both',
      };

      const asAdmin = await graphql(query, { filters }, admin);
      const asWriter = await graphql(query, { filters }, writer);
      const everything = await graphql(
        query,
        { filters: { statuses: ['APPROVED', 'PENDING'] } },
        admin,
      );

      expect(asAdmin.data.tagsConnection.edges).toContainEqual({
        node: {
          name,
          status: 'PENDING',
          requesterUserId: config.userIds.writer,
        },
      });
      expect(asWriter.data.tagsConnection.edges).toBeEmpty();
      expect(
        everything.data.tagsConnection.edges.map(
          ({ node }: { node: { status: string } }) => node.status,
        ),
      ).toIncludeAllMembers(['APPROVED', 'PENDING']);
    });

    it('should never show the requester to anybody but the admin', async () => {
      const { id, name } = await requestAsWriter(
        uniqueName('requester'),
      );
      await graphql(APPROVE_TAG, { id }, admin);
      const query = `#graphql
        query Requester($filters: TagFiltersInput) {
          tagsConnection(first: 10, filters: $filters) {
            edges { node { requesterUserId } }
          }
        }
      `;

      const asWriter = await graphql(
        query,
        { filters: { search: name } },
        writer,
      );
      const asAnonymous = await graphql(query, {
        filters: { search: name },
      });

      expect(asWriter.data.tagsConnection.edges).toEqual([
        { node: { requesterUserId: null } },
      ]);
      expect(asAnonymous.data.tagsConnection.edges).toEqual([
        { node: { requesterUserId: null } },
      ]);
    });

    it('should NOT allow a novel to use it until an admin approves it', async () => {
      const { id, name } = await requestAsWriter(uniqueName('novel'));
      const input = {
        name: 'The Lantern Keeper',
        description: 'A lighthouse keeper finds a door in the fog.',
        tags: [name],
      };

      const before = await graphql(CREATE_NOVEL, { input }, writer);
      await graphql(APPROVE_TAG, { id }, admin);
      const after = await graphql(CREATE_NOVEL, { input }, writer);

      expect(before.errors[0].message).toContain(
        `These tags are not available: ${name}`,
      );
      expect(after.errors).toBeUndefined();
      expect(after.data.createNovel.tags).toEqual([name]);
    });
  });

  describe('createTag', () => {
    it('should let an admin create a tag that is APPROVED right away', async () => {
      const name = uniqueName('create');

      const data = await graphql(
        CREATE_TAG,
        { name: ` ${name} `, description: DESCRIPTION },
        admin,
      );

      expect(data.errors).toBeUndefined();
      expect(data.data.createTag).toStrictEqual({
        id: expect.toBeString(),
        name,
        description: DESCRIPTION,
        status: 'APPROVED',
      });
    });

    it.each([
      { caller: 'a writer', header: () => writer },
      { caller: 'a plain user', header: () => user },
    ])('should NOT let $caller create a tag', async ({ header }) => {
      const data = await graphql(
        CREATE_TAG,
        { name: uniqueName('denied'), description: DESCRIPTION },
        header(),
      );

      expect(data.errors[0].message).toContain(
        'You need at least the "admin" role',
      );
    });

    it('should answer 400 when the name exists in another case', async () => {
      const name = uniqueName('dup');
      await graphql(
        CREATE_TAG,
        { name, description: DESCRIPTION },
        admin,
      );

      const data = await graphql(
        CREATE_TAG,
        { name: name.toUpperCase(), description: DESCRIPTION },
        admin,
      );

      expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
    });
  });

  describe('approveTag, updateTag and deleteTag', () => {
    it.each([
      {
        name: 'approve',
        query: APPROVE_TAG,
        variables: { id: unknownId },
      },
      {
        name: 'update',
        query: UPDATE_TAG,
        variables: { id: unknownId, name: 'x' },
      },
      {
        name: 'delete',
        query: DELETE_TAG,
        variables: { id: unknownId },
      },
    ])(
      'should NOT let a writer $name a tag',
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
        query: APPROVE_TAG,
        variables: { id: unknownId },
      },
      {
        name: 'update',
        query: UPDATE_TAG,
        variables: { id: unknownId, name: 'x' },
      },
      {
        name: 'delete',
        query: DELETE_TAG,
        variables: { id: unknownId },
      },
    ])(
      'should answer 404 when the admin tries to $name an unknown tag',
      async ({ query, variables }) => {
        const data = await graphql(query, variables, admin);

        expect(data.errors[0].message).toBe('Tag not found');
      },
    );

    it('should approve a pending tag, and again without a change', async () => {
      const { id, name } = await requestAsWriter(
        uniqueName('approve'),
      );

      const first = await graphql(APPROVE_TAG, { id }, admin);
      const second = await graphql(APPROVE_TAG, { id }, admin);

      expect(first.data.approveTag).toStrictEqual({
        id,
        name,
        status: 'APPROVED',
      });
      expect(second.data.approveTag).toStrictEqual(
        first.data.approveTag,
      );
    });

    it('should rename a tag, trimmed, and the novels follow', async () => {
      const { id, name } = await requestAsWriter(
        uniqueName('rename'),
      );
      await graphql(APPROVE_TAG, { id }, admin);
      const novel = await graphql(
        CREATE_NOVEL,
        {
          input: {
            name: 'The Lantern Keeper',
            description:
              'A lighthouse keeper finds a door in the fog.',
            tags: [name],
          },
        },
        writer,
      );
      const renamed = uniqueName('renamed');

      const data = await graphql(
        UPDATE_TAG,
        { id, name: `  ${renamed} ` },
        admin,
      );
      const read = await graphql(NOVEL_TAGS, {
        id: novel.data.createNovel.id,
      });

      expect(data.data.updateTag).toStrictEqual({
        id,
        name: renamed,
        description: DESCRIPTION,
        status: 'APPROVED',
      });
      expect(read.data.novel.tags).toEqual([renamed]);
    });

    it('should answer 400 naming the tag when renaming to an existing one', async () => {
      const { id } = await requestAsWriter(uniqueName('clash'));

      const data = await graphql(
        UPDATE_TAG,
        { id, name: 'FANTASY' },
        admin,
      );

      expect(data.errors[0].message).toContain('"FANTASY"');
      expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
    });

    it('should let the admin review a request: fix the description, then approve', async () => {
      const { id, name } = await requestAsWriter(
        uniqueName('reviewed'),
      );

      const updated = await graphql(
        UPDATE_TAG,
        { id, description: '  Lighthouses, fog and doors.  ' },
        admin,
      );
      await graphql(APPROVE_TAG, { id }, admin);
      const read = await graphql(TAG_DESCRIPTION, { search: name });

      expect(updated.data.updateTag).toStrictEqual({
        id,
        name,
        description: 'Lighthouses, fog and doors.',
        status: 'PENDING',
      });
      expect(read.data.tagsConnection.edges).toEqual([
        {
          node: { id, description: 'Lighthouses, fog and doors.' },
        },
      ]);
    });

    it('should change the name and the description in one call', async () => {
      const { id } = await requestAsWriter(uniqueName('both'));
      const renamed = uniqueName('both-renamed');

      const data = await graphql(
        UPDATE_TAG,
        { id, name: renamed, description: 'New text.' },
        admin,
      );

      expect(data.data.updateTag).toStrictEqual({
        id,
        name: renamed,
        description: 'New text.',
        status: 'PENDING',
      });
    });

    it('should answer 400 when there is nothing to change', async () => {
      const { id } = await requestAsWriter(uniqueName('nothing'));

      const data = await graphql(UPDATE_TAG, { id }, admin);

      expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
    });

    it('should reject a description longer than 650 characters', async () => {
      const { id } = await requestAsWriter(uniqueName('too-long'));

      const data = await graphql(
        UPDATE_TAG,
        { id, description: 'a'.repeat(651) },
        admin,
      );

      expect(data.errors[0].message).toContain('at most 650');
      expect(data.errors[0].extensions.code).toBe('BAD_REQUEST');
    });

    it('should delete an approved tag from its novels and keep the novels', async () => {
      const { id, name } = await requestAsWriter(
        uniqueName('delete'),
      );
      await graphql(APPROVE_TAG, { id }, admin);
      const novel = await graphql(
        CREATE_NOVEL,
        {
          input: {
            name: 'The Lantern Keeper',
            description:
              'A lighthouse keeper finds a door in the fog.',
            tags: [name, 'fantasy'],
          },
        },
        writer,
      );

      const data = await graphql(DELETE_TAG, { id }, admin);
      const read = await graphql(NOVEL_TAGS, {
        id: novel.data.createNovel.id,
      });

      expect(data.data.deleteTag).toStrictEqual({ id });
      expect(read.data.novel.tags).toEqual(['fantasy']);
    });

    it('should reject a pending request by deleting it', async () => {
      const { id, name } = await requestAsWriter(
        uniqueName('reject'),
      );

      await graphql(DELETE_TAG, { id }, admin);

      expect(await pendingNames(admin)).not.toContain(name);
    });
  });
});

describe('Tag approximateNovelCount (e2e)', () => {
  const WITH_COUNT = `#graphql
    query WithCount {
      tagsConnection(first: 100) {
        edges { node { name approximateNovelCount } }
      }
    }
  `;

  it('should estimate the novels of each tag from the planner once the table is analyzed', async () => {
    ClusterFixture.queryDatabase('ANALYZE novel_tags;');

    const { data } = await axios.post('/graphql', {
      query: WITH_COUNT,
    });

    const nodes: { name: string; approximateNovelCount: number }[] =
      data.data.tagsConnection.edges.map(
        ({ node }: { node: object }) => node,
      );
    const fantasy = nodes.find(({ name }) => name === 'fantasy');
    expect(data.errors).toBeUndefined();
    expect(nodes).toSatisfyAll(
      ({ approximateNovelCount }) =>
        Number.isInteger(approximateNovelCount) &&
        approximateNovelCount >= 0,
    );
    expect(fantasy?.approximateNovelCount).toBeGreaterThan(0);
  });
});

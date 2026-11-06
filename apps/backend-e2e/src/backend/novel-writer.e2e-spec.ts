import axios from 'axios';
import { randomUUID } from 'node:crypto';

import { AuthorizationFixture, ClusterFixture } from '../support';

const WRITER_FIELDS = `#graphql
  fragment WriterFields on NovelWriter {
    userId
    penName
    name
    email
    status
    createdAt
    applications {
      note
    }
  }
`;
const NOVEL = `#graphql
  ${WRITER_FIELDS}
  query NovelWriter($id: ID!) {
    novel(id: $id) {
      id
      writer {
        ...WriterFields
      }
    }
  }
`;
const NOVELS = `#graphql
  ${WRITER_FIELDS}
  query NovelsWriter {
    novelsConnection(first: 100) {
      edges {
        node {
          id
          writer {
            ...WriterFields
          }
        }
      }
    }
  }
`;
const CREATE_NOVEL = `#graphql
  ${WRITER_FIELDS}
  mutation CreateNovel($input: CreateNovelInput!) {
    createNovel(input: $input) {
      id
      writer {
        ...WriterFields
      }
    }
  }
`;
const DELETE_NOVEL = `#graphql
  mutation DeleteNovel($id: ID!) {
    deleteNovel(id: $id) {
      id
    }
  }
`;
const WHO_AM_I = `#graphql
  query WhoAmI {
    whoAmI {
      sub
    }
  }
`;

const SEEDED_NOVEL_ID = 'c1d31ec2-f478-4648-b90b-d1e53de2a829';
const ONLY_THE_PEN_NAME = {
  penName: expect.any(String),
  userId: expect.stringMatching(/^\d+$/),
  name: null,
  email: null,
  status: null,
  createdAt: null,
  applications: null,
};

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

  expect(data.errors).toBeUndefined();

  return data.data;
}

describe('Novel writer (e2e)', () => {
  let admin: string;
  let secondWriter: string;
  let secondWriterId: string;
  let secondWriterPenName: string;
  let novelId: string;

  beforeAll(async () => {
    admin = await AuthorizationFixture.getAdminAuthorizationHeader();
    secondWriter =
      await AuthorizationFixture.getWriterAuthorizationHeader({
        fresh: true,
      });
    secondWriterId = (await graphql(WHO_AM_I, {}, secondWriter))
      .whoAmI.sub;
    secondWriterPenName = (
      await graphql('{ myWriter { penName } }', {}, secondWriter)
    ).myWriter.penName;
    novelId = (
      await graphql(
        CREATE_NOVEL,
        {
          input: {
            name: `Salt Road ${randomUUID().slice(0, 8)}`,
            description: 'A caravan crosses a dry sea bed.',
          },
        },
        secondWriter,
      )
    ).createNovel.id;
  });

  afterAll(async () => {
    setStatus('APPROVED');
    await graphql(DELETE_NOVEL, { id: novelId }, admin);
  });

  function setStatus(status: string) {
    ClusterFixture.queryDatabase(
      `UPDATE writers SET status = '${status}' WHERE user_id = '${secondWriterId}';`,
    );
  }

  it.each([
    {
      viewer: 'an anonymous caller',
      getHeader: async () => undefined,
    },
    {
      viewer: 'a user',
      getHeader: () =>
        AuthorizationFixture.getUserAuthorizationHeader(),
    },
    {
      viewer: 'a writer',
      getHeader: () =>
        AuthorizationFixture.getWriterAuthorizationHeader(),
    },
  ])(
    'should show $viewer only the pen name of an approved writer',
    async ({ getHeader }) => {
      const data = await graphql(
        NOVEL,
        { id: SEEDED_NOVEL_ID },
        await getHeader(),
      );

      expect(data.novel.writer).toStrictEqual({
        ...ONLY_THE_PEN_NAME,
        penName: 'Writer_User',
      });
    },
  );

  it('should show the same on the list of novels', async () => {
    const data = await graphql(NOVELS, {});

    const writers = data.novelsConnection.edges.map(
      ({ node }: { node: { writer: unknown } }) => node.writer,
    );
    expect(writers).not.toBeEmpty();
    for (const writer of writers) {
      expect(writer).toStrictEqual(ONLY_THE_PEN_NAME);
    }
  });

  it('should give an admin the name, email, status and applications too', async () => {
    const data = await graphql(NOVEL, { id: SEEDED_NOVEL_ID }, admin);

    expect(data.novel.writer).toStrictEqual({
      userId: expect.stringMatching(/^\d+$/),
      penName: 'Writer_User',
      name: 'Writer User',
      email: 'writer@test.com',
      status: 'APPROVED',
      createdAt: expect.any(String),
      applications: [],
    });
  });

  it('should show a seeded writer as the writer of the novel they create', async () => {
    const data = await graphql(NOVEL, { id: novelId }, admin);

    expect(data.novel.writer).toMatchObject({
      userId: secondWriterId,
      penName: secondWriterPenName,
      name: 'Fresh User',
    });
  });

  it('should hide a writer who is not approved from everybody but an admin', async () => {
    setStatus('REJECTED');

    const anonymous = await graphql(NOVEL, { id: novelId });
    const asAdmin = await graphql(NOVEL, { id: novelId }, admin);

    expect(anonymous.novel.writer).toBeNull();
    expect(asAdmin.novel.writer).toMatchObject({
      userId: secondWriterId,
      status: 'REJECTED',
    });
  });

  it('should let the admin create a novel, since the seeder gave the admin a writer record', async () => {
    const created = await graphql(
      CREATE_NOVEL,
      {
        input: {
          name: `Admin Novel ${randomUUID().slice(0, 8)}`,
          description: 'Written by the admin.',
        },
      },
      admin,
    );

    expect(created.createNovel.writer).toMatchObject({
      penName: 'Admin_User',
      email: 'admin@test.com',
    });

    await graphql(
      DELETE_NOVEL,
      { id: created.createNovel.id },
      admin,
    );
  });
});

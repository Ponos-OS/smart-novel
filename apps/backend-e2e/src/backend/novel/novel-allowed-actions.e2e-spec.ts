import axios from 'axios';

import { AuthorizationFixture, NovelFixture } from '../../support';

const NOVEL_QUERY = `#graphql
  query GetNovel($id: ID!) {
    novel(id: $id) {
      id
      allowedActions
    }
  }
`;

describe('Novel allowedActions (e2e)', () => {
  let NOVEL_ID: string;

  beforeAll(async () => {
    ({ novelId: NOVEL_ID } = await NovelFixture.create());
  });

  it('should return MANAGE_TTS and EDIT_CONTENT for the novel owner (writer)', async () => {
    const authorization =
      await AuthorizationFixture.getWriterAuthorizationHeader();

    const { data } = await axios.post(
      '/graphql',
      {
        query: NOVEL_QUERY,
        variables: { id: NOVEL_ID },
      },
      { headers: { Authorization: authorization } },
    );

    expect(data.data.novel.allowedActions).toEqual([
      'MANAGE_TTS',
      'EDIT_CONTENT',
    ]);
  });

  it('should return MANAGE_TTS and EDIT_CONTENT for an admin', async () => {
    const authorization =
      await AuthorizationFixture.getAdminAuthorizationHeader();

    const { data } = await axios.post(
      '/graphql',
      {
        query: NOVEL_QUERY,
        variables: { id: NOVEL_ID },
      },
      { headers: { Authorization: authorization } },
    );

    expect(data.data.novel.allowedActions).toEqual([
      'MANAGE_TTS',
      'EDIT_CONTENT',
    ]);
  });

  it('should return an empty array for a writer who does not own the novel', async () => {
    const authorization =
      await AuthorizationFixture.getWriterAuthorizationHeader({
        fresh: true,
      });

    const { data } = await axios.post(
      '/graphql',
      {
        query: NOVEL_QUERY,
        variables: { id: NOVEL_ID },
      },
      { headers: { Authorization: authorization } },
    );

    expect(data.data.novel.allowedActions).toEqual([]);
  });

  it('should return an empty array for a regular user', async () => {
    const authorization =
      await AuthorizationFixture.getUserAuthorizationHeader();

    const { data } = await axios.post(
      '/graphql',
      {
        query: NOVEL_QUERY,
        variables: { id: NOVEL_ID },
      },
      { headers: { Authorization: authorization } },
    );

    expect(data.data.novel.allowedActions).toEqual([]);
  });

  it('should return an empty array for an unauthenticated request', async () => {
    const { data } = await axios.post('/graphql', {
      query: NOVEL_QUERY,
      variables: { id: NOVEL_ID },
    });

    expect(data.data.novel.allowedActions).toEqual([]);
  });
});

import axios from 'axios';
import { randomUUID } from 'node:crypto';

import { AuthorizationFixture } from '../../support';

const CREATE_UPLOAD_URL = `#graphql
  mutation CreateNovelCoverUploadUrl($novelId: ID!, $contentType: String!, $contentLength: Int!) {
    createNovelCoverUploadUrl(novelId: $novelId, contentType: $contentType, contentLength: $contentLength) {
      uploadUrl
      objectKey
    }
  }
`;

const SET_COVER = `#graphql
  mutation SetNovelCover($novelId: ID!, $objectKey: String!) {
    setNovelCover(novelId: $novelId, objectKey: $objectKey) {
      id
      coverUrl
    }
  }
`;

// A valid 1x1 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const FRONTEND_ORIGIN = 'http://localhost:8080';

async function graphql(
  query: string,
  variables: Record<string, unknown>,
  authorization: string,
) {
  const { data } = await axios.post(
    '/graphql',
    { query, variables },
    { headers: { Authorization: authorization } },
  );

  return data;
}

function putToBucket(
  uploadUrl: string,
  body: Buffer,
  contentType: string,
) {
  return fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body,
  });
}

describe('Novel cover (e2e)', () => {
  async function createNovel() {
    const writer =
      await AuthorizationFixture.getWriterAuthorizationHeader();
    const data = await graphql(
      `
        #graphql
        mutation CreateNovel($input: CreateNovelInput!) {
          createNovel(input: $input) {
            id
          }
        }
      `,
      {
        input: {
          name: 'The Lantern Keeper',
          description: 'A lighthouse keeper finds a door in the fog.',
        },
      },
      writer,
    );

    return { novelId: data.data.createNovel.id as string, writer };
  }

  async function uploadCover(
    novelId: string,
    authorization: string,
    image = PNG,
  ) {
    const urlData = await graphql(
      CREATE_UPLOAD_URL,
      {
        novelId,
        contentType: 'image/png',
        contentLength: image.length,
      },
      authorization,
    );
    const { uploadUrl, objectKey } =
      urlData.data.createNovelCoverUploadUrl;
    const response = await putToBucket(uploadUrl, image, 'image/png');

    return { uploadUrl, objectKey, response };
  }

  it('should upload from the browser-reachable endpoint, confirm and serve the cover', async () => {
    const { novelId, writer } = await createNovel();

    const { uploadUrl, objectKey, response } = await uploadCover(
      novelId,
      writer,
    );
    const confirmed = await graphql(
      SET_COVER,
      { novelId, objectKey },
      writer,
    );

    expect(new URL(uploadUrl).host).toBe('s3.localhost:8080');
    expect(objectKey).toMatch(
      new RegExp(`^covers/${novelId}/[0-9a-f-]{36}\\.png$`),
    );
    expect(response.status).toBe(200);
    expect(confirmed.errors).toBeUndefined();
    expect(confirmed.data.setNovelCover.coverUrl).toContain(
      objectKey,
    );
    const cover = await fetch(confirmed.data.setNovelCover.coverUrl);
    expect(cover.status).toBe(200);
    expect(Buffer.from(await cover.arrayBuffer())).toEqual(PNG);
  });

  it('should answer the browser preflight for the frontend origin', async () => {
    const { novelId, writer } = await createNovel();
    const urlData = await graphql(
      CREATE_UPLOAD_URL,
      {
        novelId,
        contentType: 'image/png',
        contentLength: PNG.length,
      },
      writer,
    );

    const preflight = await fetch(
      urlData.data.createNovelCoverUploadUrl.uploadUrl,
      {
        method: 'OPTIONS',
        headers: {
          Origin: FRONTEND_ORIGIN,
          'Access-Control-Request-Method': 'PUT',
          'Access-Control-Request-Headers': 'content-type',
        },
      },
    );

    expect(preflight.headers.get('access-control-allow-origin')).toBe(
      FRONTEND_ORIGIN,
    );
    expect(
      preflight.headers.get('access-control-allow-methods'),
    ).toContain('PUT');
  });

  it('should remove the previous cover from the bucket when a new one is set', async () => {
    const { novelId, writer } = await createNovel();
    const first = await uploadCover(novelId, writer);
    const firstConfirmed = await graphql(
      SET_COVER,
      { novelId, objectKey: first.objectKey },
      writer,
    );
    const second = await uploadCover(novelId, writer);

    const secondConfirmed = await graphql(
      SET_COVER,
      { novelId, objectKey: second.objectKey },
      writer,
    );

    expect(secondConfirmed.data.setNovelCover.coverUrl).toContain(
      second.objectKey,
    );
    const previous = await fetch(
      firstConfirmed.data.setNovelCover.coverUrl,
    );
    expect(previous.status).toBe(404);
    const current = await fetch(
      secondConfirmed.data.setNovelCover.coverUrl,
    );
    expect(current.status).toBe(200);
  });

  describe('rejections', () => {
    it.each([
      {
        name: 'a type that is not allowed',
        contentType: 'image/gif',
        contentLength: 1024,
      },
      {
        name: 'a declared size above 5 MB',
        contentType: 'image/png',
        contentLength: 5 * 1024 * 1024 + 1,
      },
      {
        name: 'a declared size of zero',
        contentType: 'image/png',
        contentLength: 0,
      },
    ])(
      'should NOT hand out an upload URL for $name',
      async ({ contentType, contentLength }) => {
        const { novelId, writer } = await createNovel();

        const data = await graphql(
          CREATE_UPLOAD_URL,
          { novelId, contentType, contentLength },
          writer,
        );

        expect(data.errors).toBeArray();
        expect(data.data).toBeNull();
      },
    );

    it('should let the bucket refuse a PUT with another content type than the one signed', async () => {
      const { novelId, writer } = await createNovel();
      const urlData = await graphql(
        CREATE_UPLOAD_URL,
        {
          novelId,
          contentType: 'image/png',
          contentLength: PNG.length,
        },
        writer,
      );

      const response = await putToBucket(
        urlData.data.createNovelCoverUploadUrl.uploadUrl,
        PNG,
        'text/html',
      );

      expect(response.status).toBe(403);
    });

    it('should let the bucket refuse a PUT with another size than the one signed', async () => {
      const { novelId, writer } = await createNovel();
      const urlData = await graphql(
        CREATE_UPLOAD_URL,
        {
          novelId,
          contentType: 'image/png',
          contentLength: PNG.length,
        },
        writer,
      );

      const response = await putToBucket(
        urlData.data.createNovelCoverUploadUrl.uploadUrl,
        Buffer.concat([PNG, PNG]),
        'image/png',
      );

      expect(response.status).toBe(403);
    });

    it('should NOT set a cover from a key of another novel', async () => {
      const mine = await createNovel();
      const other = await createNovel();
      const uploaded = await uploadCover(other.novelId, other.writer);

      const data = await graphql(
        SET_COVER,
        { novelId: mine.novelId, objectKey: uploaded.objectKey },
        mine.writer,
      );

      expect(data.errors[0].message).toContain(
        'not an upload URL key',
      );
    });

    it('should NOT set a cover from a key that was never uploaded', async () => {
      const { novelId, writer } = await createNovel();

      const data = await graphql(
        SET_COVER,
        {
          novelId,
          objectKey: `covers/${novelId}/${randomUUID()}.png`,
        },
        writer,
      );

      expect(data.errors[0].message).toContain(
        'Nothing was uploaded',
      );
    });

    it('should NOT set a cover from an arbitrary key', async () => {
      const { novelId, writer } = await createNovel();

      const data = await graphql(
        SET_COVER,
        { novelId, objectKey: 'narrations/anything.mp3' },
        writer,
      );

      expect(data.errors[0].message).toContain(
        'not an upload URL key',
      );
    });
  });

  describe('permissions', () => {
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
      'should NOT allow $role to request an upload URL or set a cover',
      async ({ getAuthorizationHeader }) => {
        const { novelId, writer } = await createNovel();
        const uploaded = await uploadCover(novelId, writer);
        const authorization = await getAuthorizationHeader();

        const urlData = await graphql(
          CREATE_UPLOAD_URL,
          {
            novelId,
            contentType: 'image/png',
            contentLength: PNG.length,
          },
          authorization,
        );
        const coverData = await graphql(
          SET_COVER,
          { novelId, objectKey: uploaded.objectKey },
          authorization,
        );

        expect(urlData.errors[0].message).toContain(
          'You do not have permission to update this novel',
        );
        expect(coverData.errors[0].message).toContain(
          'You do not have permission to update this novel',
        );
      },
    );

    it('should allow an admin to change the cover of any novel', async () => {
      const { novelId } = await createNovel();
      const admin =
        await AuthorizationFixture.getAdminAuthorizationHeader();
      const uploaded = await uploadCover(novelId, admin);

      const data = await graphql(
        SET_COVER,
        { novelId, objectKey: uploaded.objectKey },
        admin,
      );

      expect(data.errors).toBeUndefined();
    });
  });
});

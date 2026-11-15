import { randomUUID } from 'node:crypto';

import { AuthorizationFixture, graphql } from '../../support';

const CREATE_UPLOAD_URL = `#graphql
  mutation CreateNovelCoverUploadURL($novelID: ID!, $contentType: String!, $contentLength: Int!) {
    createNovelCoverUploadURL(novelID: $novelID, contentType: $contentType, contentLength: $contentLength) {
      uploadURL
      objectKey
    }
  }
`;

const SET_COVER = `#graphql
  mutation SetNovelCover($novelID: ID!, $objectKey: String!) {
    setNovelCover(novelID: $novelID, objectKey: $objectKey) {
      id
      coverURL
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

// A valid 1x1 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const FRONTEND_ORIGIN = 'http://localhost:8080';

function putToBucket(
  uploadURL: string,
  body: Buffer,
  contentType: string,
) {
  return fetch(uploadURL, {
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
        novelID: novelId,
        contentType: 'image/png',
        contentLength: image.length,
      },
      authorization,
    );
    const { uploadURL, objectKey } =
      urlData.data.createNovelCoverUploadURL;
    const response = await putToBucket(uploadURL, image, 'image/png');

    return { uploadURL, objectKey, response };
  }

  it('should upload from the browser-reachable endpoint, confirm and serve the cover', async () => {
    const { novelId, writer } = await createNovel();

    const { uploadURL, objectKey, response } = await uploadCover(
      novelId,
      writer,
    );
    const confirmed = await graphql(
      SET_COVER,
      { novelID: novelId, objectKey },
      writer,
    );

    expect(new URL(uploadURL).host).toBe('s3.localhost:8080');
    expect(objectKey).toMatch(
      new RegExp(`^covers/${novelId}/[0-9a-f-]{36}\\.png$`),
    );
    expect(response.status).toBe(200);
    expect(confirmed.errors).toBeUndefined();
    expect(confirmed.data.setNovelCover.coverURL).toContain(
      objectKey,
    );
    const cover = await fetch(confirmed.data.setNovelCover.coverURL);
    expect(cover.status).toBe(200);
    expect(Buffer.from(await cover.arrayBuffer())).toEqual(PNG);
  });

  it('should answer the browser preflight for the frontend origin', async () => {
    const { novelId, writer } = await createNovel();
    const urlData = await graphql(
      CREATE_UPLOAD_URL,
      {
        novelID: novelId,
        contentType: 'image/png',
        contentLength: PNG.length,
      },
      writer,
    );

    const preflight = await fetch(
      urlData.data.createNovelCoverUploadURL.uploadURL,
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
      { novelID: novelId, objectKey: first.objectKey },
      writer,
    );
    const second = await uploadCover(novelId, writer);

    const secondConfirmed = await graphql(
      SET_COVER,
      { novelID: novelId, objectKey: second.objectKey },
      writer,
    );

    expect(secondConfirmed.data.setNovelCover.coverURL).toContain(
      second.objectKey,
    );
    const previous = await fetch(
      firstConfirmed.data.setNovelCover.coverURL,
    );
    expect(previous.status).toBe(404);
    const current = await fetch(
      secondConfirmed.data.setNovelCover.coverURL,
    );
    expect(current.status).toBe(200);
  });

  it('should remove the cover from the bucket when the novel is deleted', async () => {
    const { novelId, writer } = await createNovel();
    const uploaded = await uploadCover(novelId, writer);
    const confirmed = await graphql(
      SET_COVER,
      { novelID: novelId, objectKey: uploaded.objectKey },
      writer,
    );

    const deleted = await graphql(
      DELETE_NOVEL,
      { id: novelId },
      writer,
    );

    expect(deleted.errors).toBeUndefined();
    const cover = await fetch(confirmed.data.setNovelCover.coverURL);
    expect(cover.status).toBe(404);
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
          { novelID: novelId, contentType, contentLength },
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
          novelID: novelId,
          contentType: 'image/png',
          contentLength: PNG.length,
        },
        writer,
      );

      const response = await putToBucket(
        urlData.data.createNovelCoverUploadURL.uploadURL,
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
          novelID: novelId,
          contentType: 'image/png',
          contentLength: PNG.length,
        },
        writer,
      );

      const response = await putToBucket(
        urlData.data.createNovelCoverUploadURL.uploadURL,
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
        { novelID: mine.novelId, objectKey: uploaded.objectKey },
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
          novelID: novelId,
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
        { novelID: novelId, objectKey: 'narrations/anything.mp3' },
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
        message: 'You need at least the "writer" role',
      },
      {
        role: 'writer who does not own the novel',
        getAuthorizationHeader: () =>
          AuthorizationFixture.getWriterAuthorizationHeader({
            fresh: true,
          }),
        message: 'You do not have permission to update this novel',
      },
    ])(
      'should NOT allow $role to request an upload URL or set a cover',
      async ({ getAuthorizationHeader, message }) => {
        const { novelId, writer } = await createNovel();
        const uploaded = await uploadCover(novelId, writer);
        const authorization = await getAuthorizationHeader();

        const urlData = await graphql(
          CREATE_UPLOAD_URL,
          {
            novelID: novelId,
            contentType: 'image/png',
            contentLength: PNG.length,
          },
          authorization,
        );
        const coverData = await graphql(
          SET_COVER,
          { novelID: novelId, objectKey: uploaded.objectKey },
          authorization,
        );

        expect(urlData.errors[0].extensions.code).toBe('FORBIDDEN');
        expect(urlData.errors[0].message).toContain(message);
        expect(coverData.errors[0].extensions.code).toBe('FORBIDDEN');
        expect(coverData.errors[0].message).toContain(message);
      },
    );

    it('should allow an admin to change the cover of any novel', async () => {
      const { novelId } = await createNovel();
      const admin =
        await AuthorizationFixture.getAdminAuthorizationHeader();
      const uploaded = await uploadCover(novelId, admin);

      const data = await graphql(
        SET_COVER,
        { novelID: novelId, objectKey: uploaded.objectKey },
        admin,
      );

      expect(data.errors).toBeUndefined();
    });
  });
});

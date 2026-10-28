import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { NovelCoverUpload } from './NovelCoverUpload';

const novelId = '78981754-46c4-4521-9216-b9b27dafeab2';
const objectKey = `covers/${novelId}/5c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f.png`;
const uploadUrl = `http://s3.localhost:8080/smart-novel/${objectKey}?X-Amz-Signature=abc`;
const createUploadUrl = vi.fn();
const setNovelCover = vi.fn();
const fetchMock = vi.fn();

vi.mock('../../generated/graphql', async () => {
  const actual = await vi.importActual<
    typeof import('../../generated/graphql')
  >('../../generated/graphql');

  return {
    ...actual,
    useCreateNovelCoverUploadUrlMutation: () => ({
      mutateAsync: createUploadUrl,
    }),
    useSetNovelCoverMutation: () => ({ mutateAsync: setNovelCover }),
  };
});

function renderUpload() {
  const queryClient = new QueryClient();
  const invalidateQueries = vi.spyOn(
    queryClient,
    'invalidateQueries',
  );

  render(
    <QueryClientProvider client={queryClient}>
      <NovelCoverUpload
        novelId={novelId}
        novelName="The Lantern Keeper"
        coverUrl={null}
      />
    </QueryClientProvider>,
  );

  return { invalidateQueries };
}

function pickFile(file: File) {
  fireEvent.change(screen.getByTestId('cover-file-input'), {
    target: { files: [file] },
  });
}

function png(name = 'lantern.png', size = 204800) {
  return new File([new Uint8Array(size)], name, {
    type: 'image/png',
  });
}

describe('NovelCoverUpload', () => {
  beforeEach(() => {
    createUploadUrl.mockReset().mockResolvedValue({
      createNovelCoverUploadUrl: { uploadUrl, objectKey },
    });
    setNovelCover.mockReset().mockResolvedValue({
      setNovelCover: { id: novelId },
    });
    fetchMock
      .mockReset()
      .mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    URL.createObjectURL = vi.fn(
      () => 'blob:http://localhost/preview',
    );
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a confirmation form with the preview, name and size after a file is picked', () => {
    // Arrange
    renderUpload();

    // Act
    pickFile(png());

    // Assert
    expect(
      screen.getByAltText('Selected cover preview'),
    ).toBeTruthy();
    expect(screen.getByText('lantern.png')).toBeTruthy();
    expect(screen.getByText('200.0 KB')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Use this cover' }),
    ).toBeEnabled();
  });

  it('uploads nothing and calls no mutation when cancelled', () => {
    // Arrange
    renderUpload();
    pickFile(png());

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // Assert
    expect(
      screen.getByRole('button', { name: 'Change cover' }),
    ).toBeTruthy();
    expect(createUploadUrl).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(setNovelCover).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'a type that is not allowed',
      file: new File(['GIF89a'], 'lantern.gif', {
        type: 'image/gif',
      }),
      message: 'The cover must be a JPEG, PNG or WebP image.',
    },
    {
      name: 'a file above 5 MB',
      file: png('huge.png', 5 * 1024 * 1024 + 1),
      message: 'The cover must be 5 MB or smaller.',
    },
    {
      name: 'an empty file',
      file: png('empty.png', 0),
      message: 'The cover file is empty.',
    },
  ])(
    'shows an error before any request for $name',
    ({ file, message }) => {
      // Arrange
      renderUpload();

      // Act
      pickFile(file);

      // Assert
      expect(screen.getByRole('alert')).toHaveTextContent(message);
      expect(
        screen.queryByAltText('Selected cover preview'),
      ).toBeNull();
      expect(createUploadUrl).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('requests the URL, uploads with the file content type, confirms and refreshes the novel', async () => {
    // Arrange
    const { invalidateQueries } = renderUpload();
    const file = png();
    pickFile(file);

    // Act
    fireEvent.click(
      screen.getByRole('button', { name: 'Use this cover' }),
    );

    // Assert
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Change cover' }),
      ).toBeTruthy(),
    );
    expect(createUploadUrl).toHaveBeenCalledExactlyOnceWith({
      novelId,
      contentType: 'image/png',
      contentLength: 204800,
    });
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
      body: file,
    });
    expect(setNovelCover).toHaveBeenCalledExactlyOnceWith({
      novelId,
      objectKey,
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['GetNovel', { id: novelId }],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['GetNovels'],
    });
  });

  it('shows the error and keeps the selection when the upload is rejected, so it can be retried', async () => {
    // Arrange
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403 });
    renderUpload();
    pickFile(png());

    // Act
    fireEvent.click(
      screen.getByRole('button', { name: 'Use this cover' }),
    );

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The upload was rejected (403).',
    );
    expect(screen.getByText('lantern.png')).toBeTruthy();
    expect(setNovelCover).not.toHaveBeenCalled();

    // Act
    fireEvent.click(
      screen.getByRole('button', { name: 'Use this cover' }),
    );

    // Assert
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Change cover' }),
      ).toBeTruthy(),
    );
    expect(setNovelCover).toHaveBeenCalledOnce();
  });

  it('shows the error and keeps the selection when the browser cannot reach the bucket', async () => {
    // Arrange
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderUpload();
    pickFile(png());

    // Act
    fireEvent.click(
      screen.getByRole('button', { name: 'Use this cover' }),
    );

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The upload failed. Check your connection and try again.',
    );
    expect(screen.getByText('lantern.png')).toBeTruthy();
  });

  it('shows the error and keeps the selection when the server refuses the upload URL', async () => {
    // Arrange
    createUploadUrl.mockRejectedValueOnce(
      new Error('You do not have permission to update this novel'),
    );
    renderUpload();
    pickFile(png());

    // Act
    fireEvent.click(
      screen.getByRole('button', { name: 'Use this cover' }),
    );

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You do not have permission to update this novel',
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText('lantern.png')).toBeTruthy();
  });

  it('shows the error and keeps the selection when confirming the cover fails', async () => {
    // Arrange
    setNovelCover.mockRejectedValueOnce(
      new Error('Nothing was uploaded'),
    );
    renderUpload();
    pickFile(png());

    // Act
    fireEvent.click(
      screen.getByRole('button', { name: 'Use this cover' }),
    );

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Nothing was uploaded',
    );
    expect(screen.getByText('lantern.png')).toBeTruthy();
  });
});

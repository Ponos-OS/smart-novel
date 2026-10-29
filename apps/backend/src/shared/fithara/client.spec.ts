import { createFitharaClient, FitharaRequestError } from './client';

describe(createFitharaClient.name, () => {
  const baseUrl = 'http://fithara:8000';
  const fetchMock = vi.fn();

  function respondWith(status: number, body: unknown) {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('posts the draft request and returns the response body', async () => {
    // Arrange
    const draftResponse = {
      assistantMessage:
        'CC BY 4.0 fits: others may adapt it with credit.',
      draft: null,
      draftChanged: false,
      recommendations: ['CC-BY-4.0'],
      disclaimers: ['This is not legal advice.'],
    };
    respondWith(200, draftResponse);
    const uut = createFitharaClient({ baseUrl, timeoutMs: 5000 });

    // Act
    const result = await uut.draft({
      message: 'I want people to remix my novel.',
      conversation: [],
      draft: null,
    });

    // Assert
    expect(result).toEqual(draftResponse);
    const [request] = fetchMock.mock.calls[0];
    expect(request.url).toBe(`${baseUrl}/v1/draft`);
    expect(request.method).toBe('POST');
  });

  it('asks for a license by its id', async () => {
    // Arrange
    respondWith(200, { id: 'CC-BY-4.0', body: 'Attribution 4.0' });
    const uut = createFitharaClient({ baseUrl, timeoutMs: 5000 });

    // Act
    await uut.getLicense('CC-BY-4.0');

    // Assert
    expect(fetchMock.mock.calls[0][0].url).toBe(
      `${baseUrl}/v1/licenses/CC-BY-4.0`,
    );
  });

  it.each([
    [
      429,
      {
        error: {
          code: 'RATE_LIMITED',
          message: 'Slow down',
          requestId: '8f14e45f-ceea-467a-9575-1f3b5b0b3c0d',
        },
      },
      'RATE_LIMITED',
      '8f14e45f-ceea-467a-9575-1f3b5b0b3c0d',
    ],
    [
      410,
      { error: { code: 'LICENSE_INACTIVE', message: 'Retired' } },
      'LICENSE_INACTIVE',
      undefined,
    ],
    [
      422,
      { detail: [{ msg: 'field required' }] },
      'INVALID_REQUEST',
      undefined,
    ],
  ])(
    'rejects a %s response with its error code',
    async (status, body, code, requestId) => {
      // Arrange
      respondWith(status, body);
      const uut = createFitharaClient({ baseUrl, timeoutMs: 5000 });

      // Act
      const promise = uut.listLicenses();

      // Assert
      await expect(promise).rejects.toMatchObject({
        name: FitharaRequestError.name,
        status,
        code,
        requestId,
      });
    },
  );

  it('rejects without a status when Fithara cannot be reached', async () => {
    // Arrange
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const uut = createFitharaClient({ baseUrl, timeoutMs: 5000 });

    // Act
    const promise = uut.listLicenses();

    // Assert
    await expect(promise).rejects.toMatchObject({
      message: 'Could not reach Fithara: fetch failed',
      status: undefined,
    });
  });
});

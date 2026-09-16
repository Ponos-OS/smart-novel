import {
  graphqlFetcher,
  GraphqlRequestError,
} from './graphql-fetcher';

describe(graphqlFetcher.name, () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubEnv('VITE_SERVICE_URL', 'http://localhost:3000');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('resolves with the response data when there are no errors', async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ data: { novel: { id: '1' } } }),
    }) as never;

    // Act
    const result = await graphqlFetcher('query {}', {})();

    // Assert
    expect(result).toEqual({ novel: { id: '1' } });
  });

  it('throws a GraphqlRequestError carrying the first error and its extensions', async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          errors: [
            {
              message:
                'This chapter was updated by someone else. Reload to get the latest version before saving.',
              extensions: { code: 'CONFLICT', status: 409 },
            },
          ],
          data: null,
        }),
    }) as never;

    // Act
    const request = graphqlFetcher('mutation {}', {})();

    // Assert
    await expect(request).rejects.toThrow(GraphqlRequestError);
    await request.catch((error: GraphqlRequestError) => {
      expect(error.message).toBe(
        'This chapter was updated by someone else. Reload to get the latest version before saving.',
      );
      expect(error.extensions).toEqual({
        code: 'CONFLICT',
        status: 409,
      });
    });
  });
});

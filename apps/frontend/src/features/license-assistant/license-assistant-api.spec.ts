import {
  LicenseAssistantMessageRole,
  useCanonicalLicenseQuery,
  useDraftLicenseMutation,
} from '../../generated/graphql';
import { toLicenseAssistantError } from './license-assistant-error';

describe('license assistant operations over HTTP', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv('VITE_SERVICE_URL', 'http://localhost:3000');
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('sends the conversation and the draft and returns the conversation to send next time', async () => {
    // Arrange
    const conversation = [
      {
        role: LicenseAssistantMessageRole.Assistant,
        content:
          'Summary of the earlier conversation:\nThe author writes novels.',
      },
      {
        role: LicenseAssistantMessageRole.User,
        content: 'Forbid resale.',
      },
      {
        role: LicenseAssistantMessageRole.Assistant,
        content: 'Done.',
      },
    ];
    fetchMock.mockResolvedValue({
      json: async () => ({
        data: {
          draftLicense: { assistantMessage: 'Done.', conversation },
        },
      }),
    });
    const input = {
      conversation: conversation.slice(0, 1),
      message: 'Forbid resale.',
      draft: {
        title: 'CC BY 4.0',
        text: '# CC BY 4.0',
        source: { type: 'CANONICAL', canonicalId: 'CC-BY-4.0' },
      },
    };

    // Act
    const result = await useDraftLicenseMutation.fetcher({
      input: input as never,
    })();

    // Assert
    const [url, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(url).toBe('http://localhost:3000/graphql');
    expect(body.query).toInclude('draftLicense');
    expect(body.variables).toEqual({ input });
    expect(result.draftLicense.conversation).toEqual(conversation);
  });

  it('turns a rate-limit answer into a state the UI can render', async () => {
    // Arrange
    fetchMock.mockResolvedValue({
      json: async () => ({
        data: null,
        errors: [
          {
            message:
              'You sent too many messages to the license assistant.',
            extensions: {
              code: 'LICENSE_ASSISTANT_RATE_LIMITED',
              status: 429,
            },
          },
        ],
      }),
    });

    // Act
    const failure = await useDraftLicenseMutation
      .fetcher({ input: { conversation: [], message: 'Hello' } })()
      .catch((error: unknown) => error);

    // Assert
    expect(toLicenseAssistantError(failure)).toMatchObject({
      kind: 'rate-limited',
      retryable: true,
    });
  });

  it('asks for a canonical license by its id', async () => {
    // Arrange
    fetchMock.mockResolvedValue({
      json: async () => ({
        data: { canonicalLicense: { id: 'CC-BY-4.0' } },
      }),
    });

    // Act
    await useCanonicalLicenseQuery.fetcher({ id: 'CC-BY-4.0' })();

    // Assert
    expect(
      JSON.parse(fetchMock.mock.calls[0][1].body).variables,
    ).toEqual({
      id: 'CC-BY-4.0',
    });
  });
});

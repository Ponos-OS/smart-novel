import type { ReactNode } from 'react';

import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';

import { LicenseSourceType } from '../../generated/graphql';
import { useLicenseAssistant } from './use-license-assistant';

const summaryTurn = {
  role: 'ASSISTANT',
  content:
    'Summary of the earlier conversation:\nThe author writes web novels.',
};
const draft = {
  title: 'CC BY 4.0 without resale',
  text: '# CC BY 4.0 without resale',
  source: {
    type: LicenseSourceType.Forked,
    canonicalId: 'CC-BY-4.0',
  },
};

function answer(overrides: Record<string, unknown> = {}) {
  return {
    assistantMessage: 'I forbade resale in section 3.',
    draft,
    draftChanged: true,
    recommendations: ['CC-BY-NC-4.0'],
    disclaimers: ['This is not legal advice.'],
    isReadyToFinalize: false,
    conversation: [
      { role: 'USER', content: 'Forbid resale.' },
      {
        role: 'ASSISTANT',
        content: 'I forbade resale in section 3.',
      },
    ],
    ...overrides,
  };
}

describe(useLicenseAssistant.name, () => {
  const fetchMock = vi.fn();

  function respondWith(...bodies: unknown[]) {
    for (const body of bodies) {
      fetchMock.mockResolvedValueOnce({ json: async () => body });
    }
  }

  function sentInput(call: number) {
    return JSON.parse(fetchMock.mock.calls[call][1].body).variables
      .input;
  }

  async function waitForSecondAnswer(result: {
    current: ReturnType<typeof useLicenseAssistant>;
  }) {
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.isPending).toBeFalse());
  }

  function renderAssistant() {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { mutations: { retry: false } },
          })
        }
      >
        {children}
      </QueryClientProvider>
    );

    return renderHook(() => useLicenseAssistant(), { wrapper });
  }

  beforeEach(() => {
    vi.stubEnv('VITE_SERVICE_URL', 'http://localhost:3000');
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    fetchMock.mockReset();
  });

  it('starts a new conversation with nothing to send but the message', async () => {
    // Arrange
    respondWith({ data: { draftLicense: answer() } });
    const { result } = renderAssistant();

    // Act
    act(() => result.current.send('Forbid resale.'));
    await waitFor(() =>
      expect(result.current.messages).toHaveLength(2),
    );

    // Assert
    expect(sentInput(0)).toEqual({
      conversation: [],
      draft: null,
      message: 'Forbid resale.',
    });
    expect(result.current.messages).toEqual([
      {
        id: expect.any(String),
        role: 'user',
        content: 'Forbid resale.',
      },
      {
        id: expect.any(String),
        role: 'assistant',
        content: 'I forbade resale in section 3.',
      },
    ]);
    expect(result.current.draft).toEqual(draft);
    expect(result.current.details).toEqual({
      disclaimers: ['This is not legal advice.'],
      recommendations: ['CC-BY-NC-4.0'],
      isReadyToFinalize: false,
      draftChanged: true,
    });
  });

  it('sends the conversation and the draft of the previous answer on the next turn', async () => {
    // Arrange
    respondWith(
      { data: { draftLicense: answer() } },
      {
        data: { draftLicense: answer({ assistantMessage: 'Done.' }) },
      },
    );
    const { result } = renderAssistant();
    act(() => result.current.send('Forbid resale.'));
    await waitFor(() =>
      expect(result.current.messages).toHaveLength(2),
    );

    // Act
    act(() => result.current.send('And explain section 3.'));
    await waitForSecondAnswer(result);

    // Assert
    expect(sentInput(1)).toEqual({
      conversation: answer().conversation,
      draft,
      message: 'And explain section 3.',
    });
  });

  it('shows and sends back the conversation the assistant returned, a condensed one included', async () => {
    // Arrange
    const condensed = [
      summaryTurn,
      { role: 'USER', content: 'Forbid resale.' },
      {
        role: 'ASSISTANT',
        content: 'I forbade resale in section 3.',
      },
    ];
    respondWith(
      { data: { draftLicense: answer({ conversation: condensed }) } },
      { data: { draftLicense: answer() } },
    );
    const { result } = renderAssistant();

    // Act
    act(() => result.current.send('One'));
    await waitFor(() =>
      expect(result.current.messages).toHaveLength(3),
    );
    const shown = result.current.messages.map(
      ({ content }) => content,
    );
    const firstRole = result.current.messages[0].role;
    act(() => result.current.send('Two'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    // Assert
    expect(shown).toEqual(condensed.map(({ content }) => content));
    expect(firstRole).toBe('assistant');
    expect(sentInput(1).conversation).toEqual(condensed);
  });

  it('keeps the draft the author has when an answer comes without one', async () => {
    // Arrange
    respondWith(
      { data: { draftLicense: answer() } },
      {
        data: {
          draftLicense: answer({ draft: null, draftChanged: false }),
        },
      },
    );
    const { result } = renderAssistant();
    act(() => result.current.send('Forbid resale.'));
    await waitFor(() => expect(result.current.draft).toEqual(draft));

    // Act
    act(() => result.current.send('Which license is popular?'));
    await waitForSecondAnswer(result);

    // Assert
    expect(result.current.draft).toEqual(draft);
  });

  it('sends the draft the author edited, not the one of the answer', async () => {
    // Arrange
    respondWith(
      { data: { draftLicense: answer() } },
      { data: { draftLicense: answer() } },
    );
    const { result } = renderAssistant();
    act(() => result.current.send('Forbid resale.'));
    await waitFor(() => expect(result.current.draft).toEqual(draft));
    const edited = { ...draft, text: '# My own wording' };

    // Act
    act(() => result.current.setDraft(edited));
    act(() => result.current.send('Explain it.'));
    await waitForSecondAnswer(result);

    // Assert
    expect(sentInput(1).draft).toEqual(edited);
  });

  it('shows what was sent while the answer is on its way, and ignores a second send', async () => {
    // Arrange
    let finish: (value: unknown) => void = () => undefined;
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = renderAssistant();

    // Act
    act(() => result.current.send('Forbid resale.'));
    await waitFor(() => expect(result.current.isPending).toBeTrue());
    act(() => result.current.send('Another one.'));

    // Assert
    expect(result.current.pendingMessage).toBe('Forbid resale.');
    expect(fetchMock).toHaveBeenCalledOnce();
    finish({
      json: async () => ({ data: { draftLicense: answer() } }),
    });
    await waitFor(() =>
      expect(result.current.pendingMessage).toBeNull(),
    );
  });

  it('keeps the messages and says what went wrong when the assistant cannot answer, then recovers', async () => {
    // Arrange
    const onSent = vi.fn();
    respondWith(
      {
        data: null,
        errors: [
          {
            message:
              'The license assistant is not available right now.',
            extensions: {
              code: 'LICENSE_ASSISTANT_UNAVAILABLE',
              requestId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            },
          },
        ],
      },
      { data: { draftLicense: answer() } },
    );
    const { result } = renderAssistant();

    // Act
    act(() => result.current.send('Forbid resale.', onSent));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    const failed = result.current.error;
    act(() => result.current.send('Forbid resale.', onSent));
    await waitFor(() =>
      expect(result.current.messages).toHaveLength(2),
    );

    // Assert
    expect(failed).toMatchObject({
      kind: 'unavailable',
      requestId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    });
    expect(onSent).toHaveBeenCalledOnce();
    expect(result.current.error).toBeNull();
    expect(result.current.pendingMessage).toBeNull();
    expect(sentInput(1).conversation).toEqual([]);
  });
});

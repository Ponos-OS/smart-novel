import type { ReactNode } from 'react';

import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';

import {
  LicenseAssistantMessageRole,
  LicenseSourceType,
} from '../../generated/graphql';
import {
  answeredDraft,
  defaultHandlers,
  draftId,
  draftRow,
  type Handlers,
  installFetch,
  requestsFor,
  storageKey,
} from './test-support';
import {
  type InitialSession,
  useLicenseAssistantSession,
} from './use-license-assistant-session';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { sub: '230104087265432001' } }),
}));

const initial: InitialSession = {
  draftId,
  draft: answeredDraft,
  conversation: [
    {
      role: LicenseAssistantMessageRole.User,
      content: 'Forbid resale.',
    },
    {
      role: LicenseAssistantMessageRole.Assistant,
      content: 'I forbade resale in section 3.',
    },
  ],
};
const createInput = {
  title: 'My license',
  source: { type: LicenseSourceType.Custom },
};

describe(useLicenseAssistantSession.name, () => {
  const fetchMock = vi.fn();
  let handlers: Handlers;
  let queryClient: QueryClient;

  function renderSession(
    options: Parameters<typeof useLicenseAssistantSession>[0] = {
      initial: null,
    },
  ) {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    return renderHook(() => useLicenseAssistantSession(options), {
      wrapper,
    });
  }

  const failWith = (message: string) => () => ({
    data: null,
    errors: [{ message, extensions: { code: 'BAD_USER_INPUT' } }],
  });

  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv('VITE_SERVICE_URL', 'http://localhost:3000');
    vi.stubGlobal('fetch', fetchMock);
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    handlers = defaultHandlers();
    installFetch(fetchMock, () => handlers);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  describe('starting', () => {
    it('begins with no draft', () => {
      const { result } = renderSession();

      expect(result.current.draftId).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('picks an initial session up as it was', () => {
      const { result } = renderSession({ initial });

      expect(result.current.draftId).toBe(draftId);
      expect(result.current.assistant.draft).toEqual(answeredDraft);
    });

    it('creates the draft and makes it the current one', async () => {
      const { result } = renderSession();

      act(() => result.current.create(createInput));

      await waitFor(() =>
        expect(result.current.draftId).toBe(draftId),
      );
      expect(requestsFor(fetchMock, 'CreateLicenseDraft')).toEqual([
        { input: createInput },
      ]);
      expect(result.current.assistant.draft).toEqual({
        title: '',
        text: '',
        source: { type: 'CUSTOM', canonicalId: null },
      });
    });

    it('reports a failed creation with the message of the backend', async () => {
      handlers.CreateLicenseDraft = failWith('Title is too long.');
      const { result } = renderSession();

      act(() => result.current.create(createInput));

      await waitFor(() =>
        expect(result.current.error).toBe('Title is too long.'),
      );
      expect(result.current.draftId).toBeNull();
    });

    it('reports a failed creation without a message as something generic', async () => {
      fetchMock.mockRejectedValueOnce(
        new TypeError('Failed to fetch'),
      );
      const { result } = renderSession();

      act(() => result.current.create(createInput));

      await waitFor(() =>
        expect(result.current.error).toBe(
          'Something went wrong. Try again later.',
        ),
      );
    });

    it('clears an earlier error when it tries again', async () => {
      handlers.CreateLicenseDraft = failWith('Title is too long.');
      const { result } = renderSession();
      act(() => result.current.create(createInput));
      await waitFor(() =>
        expect(result.current.error).not.toBeNull(),
      );
      handlers.CreateLicenseDraft = () => ({
        data: { createLicenseDraft: draftRow() },
      });

      act(() => result.current.create(createInput));

      await waitFor(() =>
        expect(result.current.draftId).toBe(draftId),
      );
      expect(result.current.error).toBeNull();
    });

    it('resumes an unfinished draft without asking the backend', () => {
      const { result } = renderSession();

      act(() =>
        result.current.resume(
          draftRow({ ...answeredDraft }) as never,
        ),
      );

      expect(result.current.draftId).toBe(draftId);
      expect(result.current.assistant.draft).toEqual(answeredDraft);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('remembering the conversation', () => {
    it('keeps the draft and the conversation in the storage of the writer', async () => {
      renderSession({ initial });

      await waitFor(() =>
        expect(
          JSON.parse(localStorage.getItem(storageKey) ?? ''),
        ).toEqual({
          draftId,
          conversation: initial.conversation,
        }),
      );
    });

    it('forgets it when there is no draft', () => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ draftId, conversation: [] }),
      );

      renderSession();

      expect(localStorage.getItem(storageKey)).toBeNull();
    });
  });

  describe('discarding', () => {
    it('discards the draft and refreshes the list of drafts', async () => {
      const discarded = vi.fn(() => ({
        data: { discardLicenseDraft: true },
      }));
      handlers.DiscardLicenseDraft = discarded;
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
      const { result } = renderSession();

      act(() => result.current.discard(draftId));

      await waitFor(() => expect(invalidate).toHaveBeenCalledOnce());
      expect(requestsFor(fetchMock, 'DiscardLicenseDraft')).toEqual([
        { id: draftId },
      ]);
    });

    it('reports a failed discard', async () => {
      handlers.DiscardLicenseDraft = failWith('Draft not found.');
      const { result } = renderSession();

      act(() => result.current.discard(draftId));

      await waitFor(() =>
        expect(result.current.error).toBe('Draft not found.'),
      );
    });
  });

  describe('starting over', () => {
    it('saves what was not saved, then leaves the draft', async () => {
      const { result } = renderSession({ initial });
      act(() =>
        result.current.assistant.setDraft({
          ...answeredDraft,
          text: 'You may share this novel.',
        }),
      );

      await act(async () => result.current.startOver());

      await waitFor(() => expect(result.current.draftId).toBeNull());
      expect(requestsFor(fetchMock, 'SaveLicenseDraft')).toEqual([
        {
          input: {
            id: draftId,
            title: answeredDraft.title,
            text: 'You may share this novel.',
            source: answeredDraft.source,
          },
        },
      ]);
      expect(localStorage.getItem(storageKey)).toBeNull();
    });

    it('does not call the backend when everything is saved', async () => {
      const { result } = renderSession({ initial });

      await act(async () => result.current.startOver());

      await waitFor(() => expect(result.current.draftId).toBeNull());
      expect(requestsFor(fetchMock, 'SaveLicenseDraft')).toBeEmpty();
    });

    it('stays on the draft and says so when the save fails', async () => {
      handlers.SaveLicenseDraft = failWith('down');
      const { result } = renderSession({ initial });
      act(() =>
        result.current.assistant.setDraft({
          ...answeredDraft,
          text: 'Changed.',
        }),
      );

      await act(async () => result.current.startOver());

      await waitFor(() =>
        expect(result.current.error).toBe(
          'Your latest changes could not be saved. Try again in a moment.',
        ),
      );
      expect(result.current.draftId).toBe(draftId);
    });
  });

  describe('finalizing', () => {
    const finalized = {
      id: 'b0a1d2c3-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
      title: answeredDraft.title,
      text: answeredDraft.text,
    };

    it('finalizes the saved draft, leaves it and hands the license over', async () => {
      handlers.FinalizeLicenseDraft = () => ({
        data: { finalizeLicenseDraft: finalized },
      });
      const onFinalized = vi.fn();
      const { result } = renderSession({ initial, onFinalized });

      await act(async () => result.current.finalize());

      await waitFor(() =>
        expect(onFinalized).toHaveBeenCalledExactlyOnceWith(
          finalized,
        ),
      );
      expect(requestsFor(fetchMock, 'FinalizeLicenseDraft')).toEqual([
        { id: draftId },
      ]);
      expect(result.current.draftId).toBeNull();
    });

    it('saves unsaved changes before it finalizes', async () => {
      handlers.FinalizeLicenseDraft = () => ({
        data: { finalizeLicenseDraft: finalized },
      });
      const { result } = renderSession({ initial });
      act(() =>
        result.current.assistant.setDraft({
          ...answeredDraft,
          text: 'Changed.',
        }),
      );

      await act(async () => result.current.finalize());

      await waitFor(() =>
        expect(
          requestsFor(fetchMock, 'FinalizeLicenseDraft'),
        ).toHaveLength(1),
      );
      const operations = fetchMock.mock.calls.map(
        ([, init]) =>
          /(?:mutation)\s+(\w+)/.exec(
            JSON.parse(init.body).query,
          )?.[1],
      );
      expect(operations).toEqual([
        'SaveLicenseDraft',
        'FinalizeLicenseDraft',
      ]);
    });

    it('does not finalize when the draft could not be saved', async () => {
      handlers.SaveLicenseDraft = failWith('down');
      const { result } = renderSession({ initial });
      act(() =>
        result.current.assistant.setDraft({
          ...answeredDraft,
          text: 'Changed.',
        }),
      );

      await act(async () => result.current.finalize());

      await waitFor(() =>
        expect(result.current.error).toBe(
          'Your latest changes could not be saved, so the draft was not finalized. Try again in a moment.',
        ),
      );
      expect(
        requestsFor(fetchMock, 'FinalizeLicenseDraft'),
      ).toBeEmpty();
    });

    it('does not finalize when there is no draft', async () => {
      const { result } = renderSession();

      await act(async () => result.current.finalize());

      await waitFor(() =>
        expect(result.current.error).not.toBeNull(),
      );
      expect(
        requestsFor(fetchMock, 'FinalizeLicenseDraft'),
      ).toBeEmpty();
    });

    it('keeps the draft and shows the reason when finalizing is refused', async () => {
      handlers.FinalizeLicenseDraft = failWith('Draft is empty.');
      const onFinalized = vi.fn();
      const { result } = renderSession({ initial, onFinalized });

      await act(async () => result.current.finalize());

      await waitFor(() =>
        expect(result.current.error).toBe('Draft is empty.'),
      );
      expect(result.current.draftId).toBe(draftId);
      expect(onFinalized).not.toHaveBeenCalled();
    });
  });
});

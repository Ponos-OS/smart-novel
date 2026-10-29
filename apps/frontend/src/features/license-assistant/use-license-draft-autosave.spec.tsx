import type { ReactNode } from 'react';

import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';

import {
  type LicenseDraftInput,
  LicenseSourceType,
} from '../../generated/graphql';
import { useLicenseDraftAutosave } from './use-license-draft-autosave';

const draftId = '5c1f4d0e-3b6a-4a57-9d3e-0b7a8f2c9e41';
const saved: LicenseDraftInput = {
  title: 'CC BY 4.0 without resale',
  text: 'You may share and adapt this novel.',
  source: {
    type: LicenseSourceType.Forked,
    canonicalId: 'CC-BY-4.0',
  },
};
const edited: LicenseDraftInput = {
  ...saved,
  text: 'You may share and adapt this novel. You may not sell it.',
};
const INTERVAL = 5000;

type Props = {
  draft: LicenseDraftInput | null;
  draftId?: string | null;
};

describe(useLicenseDraftAutosave.name, () => {
  const fetchMock = vi.fn();

  function answerSave(result: 'ok' | 'fail') {
    fetchMock.mockImplementationOnce(async () => ({
      json: async () =>
        result === 'ok'
          ? { data: { saveLicenseDraft: { id: draftId } } }
          : {
              data: null,
              errors: [
                { message: 'down', extensions: { code: 'X' } },
              ],
            },
    }));
  }

  function renderAutosave(initialProps: Props) {
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

    return renderHook(
      (props: Props) =>
        useLicenseDraftAutosave({
          draftId:
            props.draftId === undefined ? draftId : props.draftId,
          draft: props.draft,
          initialSaved: saved,
          intervalMs: INTERVAL,
        }),
      { wrapper, initialProps },
    );
  }

  async function tick() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INTERVAL);
    });
  }

  function sentInputs() {
    return fetchMock.mock.calls.map(
      ([, init]) => JSON.parse(init.body).variables.input,
    );
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_SERVICE_URL', 'http://localhost:3000');
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('saves nothing while the draft is what the backend has', async () => {
    // Arrange
    const { result } = renderAutosave({ draft: saved });

    // Act
    await tick();
    await tick();

    // Assert
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.status).toBe('saved');
  });

  it('saves a changed draft at the next tick, once, and then rests', async () => {
    // Arrange
    answerSave('ok');
    const { result, rerender } = renderAutosave({ draft: saved });

    // Act
    rerender({ draft: edited });
    const beforeTick = result.current.status;
    await tick();
    await tick();

    // Assert
    expect(beforeTick).toBe('unsaved');
    expect(sentInputs()).toEqual([
      {
        id: draftId,
        title: edited.title,
        text: edited.text,
        source: edited.source,
      },
    ]);
    expect(result.current.status).toBe('saved');
  });

  it('says it failed, keeps the draft marked as not saved, and tries again at the next tick', async () => {
    // Arrange
    answerSave('fail');
    answerSave('ok');
    const { result, rerender } = renderAutosave({ draft: saved });
    rerender({ draft: edited });

    // Act
    await tick();
    const afterFailure = result.current.status;
    await tick();

    // Assert
    expect(afterFailure).toBe('failed');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('saved');
  });

  it('saves nothing without a draft on the backend', async () => {
    // Arrange
    const { rerender } = renderAutosave({
      draft: saved,
      draftId: null,
    });

    // Act
    rerender({ draft: edited, draftId: null });
    await tick();

    // Assert
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends what changed while a save was on its way at the tick after, not before it finished', async () => {
    // Arrange
    let finish: (value: unknown) => void = () => undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    answerSave('ok');
    const { result, rerender } = renderAutosave({ draft: saved });
    rerender({ draft: edited });
    await tick();
    const newer = { ...edited, title: 'No resale, no remixes' };

    // Act
    rerender({ draft: newer });
    await tick();
    const duringFlight = fetchMock.mock.calls.length;
    await act(async () => {
      finish({
        json: async () => ({
          data: { saveLicenseDraft: { id: draftId } },
        }),
      });
    });
    await tick();

    // Assert
    expect(duringFlight).toBe(1);
    expect(sentInputs().map(({ title }) => title)).toEqual([
      edited.title,
      'No resale, no remixes',
    ]);
    expect(result.current.status).toBe('saved');
  });

  describe('flush', () => {
    it('saves right away and says it worked', async () => {
      // Arrange
      answerSave('ok');
      const { result, rerender } = renderAutosave({ draft: saved });
      rerender({ draft: edited });

      // Act
      let saved$ = false;
      await act(async () => {
        saved$ = await result.current.flush();
      });

      // Assert
      expect(saved$).toBeTrue();
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(result.current.status).toBe('saved');
    });

    it('says it did not work when the save failed', async () => {
      // Arrange
      answerSave('fail');
      const { result, rerender } = renderAutosave({ draft: saved });
      rerender({ draft: edited });

      // Act
      let worked = true;
      await act(async () => {
        worked = await result.current.flush();
      });

      // Assert
      expect(worked).toBeFalse();
      expect(result.current.status).toBe('failed');
    });

    it('has nothing to do when nothing changed', async () => {
      // Arrange
      const { result } = renderAutosave({ draft: saved });

      // Act
      let worked = false;
      await act(async () => {
        worked = await result.current.flush();
      });

      // Assert
      expect(worked).toBeTrue();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('does not save what it was told the backend already has', async () => {
    // Arrange
    const { result, rerender } = renderAutosave({ draft: saved });
    rerender({ draft: edited });

    // Act
    act(() => result.current.markSaved(edited));
    await tick();

    // Assert
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.status).toBe('saved');
  });
});

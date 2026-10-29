import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type LicenseDraftInput,
  useSaveLicenseDraftMutation,
} from '../../generated/graphql';
import { getAutosaveIntervalMs } from './autosave-interval';

export type DraftSyncStatus =
  | 'saved'
  | 'unsaved'
  | 'saving'
  | 'failed';

interface Options {
  /** @description The draft on the backend; nothing is saved without one. */
  draftId: string | null;
  /** @description The draft as the author has it now. */
  draft: LicenseDraftInput | null;
  /** @description What the backend has when the hook starts, e.g. a draft that was just loaded. */
  initialSaved?: LicenseDraftInput | null;
  intervalMs?: number;
}

function snapshot(draft: LicenseDraftInput | null): string {
  return JSON.stringify(
    draft && {
      title: draft.title,
      text: draft.text,
      type: draft.source.type,
      canonicalId: draft.source.canonicalId ?? null,
    },
  );
}

/**
 * @description Saves the draft to the backend on an interval, and only when it differs from what the backend has. A failed save leaves the draft marked as not saved, so the next tick tries again; nothing interrupts the author.
 */
export function useLicenseDraftAutosave({
  draftId,
  draft,
  initialSaved = null,
  intervalMs = getAutosaveIntervalMs(),
}: Options) {
  const mutation = useSaveLicenseDraftMutation();
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    snapshot(initialSaved),
  );
  const [phase, setPhase] = useState<'idle' | 'saving' | 'failed'>(
    'idle',
  );
  const latest = useRef({ draftId, draft, savedSnapshot });
  const inFlight = useRef<Promise<boolean> | null>(null);

  // Read by the ticks and by `flush`; updated after each render, not during it.
  useEffect(() => {
    latest.current = { draftId, draft, savedSnapshot };
  });

  const save = useCallback((): Promise<boolean> => {
    const run = (): Promise<boolean> => {
      const {
        draftId: id,
        draft: current,
        savedSnapshot: saved,
      } = latest.current;
      const sent = snapshot(current);

      if (!id || !current || sent === saved) {
        return Promise.resolve(true);
      }

      setPhase('saving');
      inFlight.current = mutation
        .mutateAsync({
          input: {
            id,
            title: current.title,
            text: current.text,
            source: current.source,
          },
        })
        .then(
          () => {
            // What was sent is what the backend has, even if the draft changed while it travelled.
            latest.current.savedSnapshot = sent;
            setSavedSnapshot(sent);
            setPhase('idle');
            return true;
          },
          () => {
            setPhase('failed');
            return false;
          },
        )
        .finally(() => {
          inFlight.current = null;
        });

      return inFlight.current;
    };

    // One save at a time: a tick that finds one on its way waits for it, then saves what changed since.
    return inFlight.current ? inFlight.current.then(run) : run();
  }, [mutation]);

  useEffect(() => {
    if (!draftId) {
      return;
    }

    const timer = setInterval(() => void save(), intervalMs);

    return () => clearInterval(timer);
  }, [draftId, intervalMs, save]);

  /** @description Tell the hook what the backend has, e.g. right after loading or creating the draft. */
  const markSaved = useCallback((saved: LicenseDraftInput | null) => {
    latest.current.savedSnapshot = snapshot(saved);
    setSavedSnapshot(snapshot(saved));
    setPhase('idle');
  }, []);

  const isDirty = snapshot(draft) !== savedSnapshot;
  let status: DraftSyncStatus = 'saved';

  if (phase === 'saving') {
    status = 'saving';
  } else if (phase === 'failed') {
    status = 'failed';
  } else if (isDirty && draft) {
    status = 'unsaved';
  }

  return { status, markSaved, flush: save };
}

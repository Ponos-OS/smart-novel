import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import {
  type CreateLicenseDraftInput,
  type FinalizeLicenseDraftMutation,
  type LicenseAssistantMessageInput,
  type LicenseDraftFieldsFragment,
  type LicenseDraftInput,
  useCreateLicenseDraftMutation,
  useDiscardLicenseDraftMutation,
  useFinalizeLicenseDraftMutation,
  useLicenseDraftsQuery,
} from '../../generated/graphql';
import { useAuth } from '../../hooks/useAuth';
import { GraphqlRequestError } from '../../lib/graphql-fetcher';
import { clearSession, saveSession } from './session-storage';
import { useLicenseAssistant } from './use-license-assistant';
import { useLicenseDraftAutosave } from './use-license-draft-autosave';

export type FinalizedLicense =
  FinalizeLicenseDraftMutation['finalizeLicenseDraft'];

/** @description A session picked up again: the draft as the backend has it, and the conversation that was kept. */
export interface InitialSession {
  draftId: string;
  draft: LicenseDraftInput;
  conversation: LicenseAssistantMessageInput[];
}

interface Options {
  initial: InitialSession | null;
  /** @description Called with the license to put on the novel once the author finalizes the draft. */
  onFinalized?: (license: FinalizedLicense) => void;
}

export function toDraftInput(
  draft: LicenseDraftFieldsFragment,
): LicenseDraftInput {
  return {
    title: draft.title,
    text: draft.text,
    source: draft.source,
  };
}

function describe(error: unknown): string {
  return error instanceof GraphqlRequestError && error.message
    ? error.message
    : 'Something went wrong. Try again later.';
}

/**
 * @description One writer's work on one draft: the draft on the backend (created, resumed, saved on an interval, finalized or left), and the conversation about it, kept in `localStorage` so closing the browser does not lose it.
 */
export function useLicenseAssistantSession({
  initial,
  onFinalized,
}: Options) {
  const { user } = useAuth();
  const userId = user?.sub ?? '';
  const queryClient = useQueryClient();
  const [draftId, setDraftId] = useState<string | null>(
    initial?.draftId ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const assistant = useLicenseAssistant(
    initial?.conversation,
    initial?.draft,
  );
  const autosave = useLicenseDraftAutosave({
    draftId,
    draft: assistant.draft,
    initialSaved: initial?.draft,
  });
  const createMutation = useCreateLicenseDraftMutation();
  const finalizeMutation = useFinalizeLicenseDraftMutation();
  const discardMutation = useDiscardLicenseDraftMutation();
  const { markSaved } = autosave;
  const { setDraft, reset } = assistant;

  useEffect(() => {
    if (draftId) {
      saveSession(userId, {
        draftId,
        conversation: assistant.conversation,
      });
    } else {
      clearSession(userId);
    }
  }, [userId, draftId, assistant.conversation]);

  const refreshDrafts = () =>
    queryClient.invalidateQueries({
      queryKey: useLicenseDraftsQuery.getKey(),
    });

  const begin = (draft: LicenseDraftFieldsFragment) => {
    const input = toDraftInput(draft);

    markSaved(input);
    reset();
    setDraft(input);
    setDraftId(draft.id);
    setError(null);
  };

  const leave = () => {
    reset();
    setDraftId(null);
    void refreshDrafts();
  };

  return {
    assistant,
    draftId,
    error,
    syncStatus: autosave.status,
    isCreating: createMutation.isPending,
    isFinalizing: finalizeMutation.isPending,

    create: (input: CreateLicenseDraftInput) => {
      setError(null);
      createMutation.mutate(
        { input },
        {
          onSuccess: ({ createLicenseDraft }) =>
            begin(createLicenseDraft),
          onError: (failure) => setError(describe(failure)),
        },
      );
    },

    /** @description Picks an unfinished draft up again; its conversation was not kept, the draft was. */
    resume: begin,

    discard: (id: string) =>
      discardMutation.mutate(
        { id },
        {
          onSuccess: () => void refreshDrafts(),
          onError: (failure) => setError(describe(failure)),
        },
      ),

    /** @description Leaves the draft (it stays among the unfinished ones) after saving what was not saved yet. */
    startOver: () =>
      void autosave.flush().then((saved) => {
        if (saved) {
          leave();
        } else {
          setError(
            'Your latest changes could not be saved. Try again in a moment.',
          );
        }
      }),

    finalize: () =>
      void autosave.flush().then((saved) => {
        if (!saved || !draftId) {
          setError(
            'Your latest changes could not be saved, so the draft was not finalized. Try again in a moment.',
          );
          return;
        }

        finalizeMutation.mutate(
          { id: draftId },
          {
            onSuccess: ({ finalizeLicenseDraft }) => {
              leave();
              onFinalized?.(finalizeLicenseDraft);
            },
            onError: (failure) => setError(describe(failure)),
          },
        );
      }),
  };
}

import { useCallback, useMemo, useState } from 'react';

import {
  type DraftLicenseMutation,
  LicenseAssistantMessageRole,
  type LicenseDraftInput,
  useDraftLicenseMutation,
} from '../../generated/graphql';
import {
  type LicenseAssistantError,
  toLicenseAssistantError,
} from './license-assistant-error';
import { withPseudoIds } from './pseudo-id';

type Conversation =
  DraftLicenseMutation['draftLicense']['conversation'];

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantAnswerDetails {
  disclaimers: string[];
  recommendations: string[];
  isReadyToFinalize: boolean;
  draftChanged: boolean;
}

/**
 * @description The state of one conversation with the license assistant. The conversation is whatever the assistant returned last, shown and sent back as it is: a long history comes back condensed, and the summary turn is just another message.
 */
export function useLicenseAssistant(
  initialConversation: Conversation = [],
  initialDraft: LicenseDraftInput | null = null,
) {
  const mutation = useDraftLicenseMutation();
  const [conversation, setConversation] = useState<Conversation>(
    initialConversation,
  );
  const [draft, setDraft] = useState<LicenseDraftInput | null>(
    initialDraft,
  );
  const [details, setDetails] =
    useState<AssistantAnswerDetails | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<LicenseAssistantError | null>(
    null,
  );
  const messages = useMemo<ConversationMessage[]>(
    () =>
      withPseudoIds(conversation).map(({ id, role, content }) => ({
        id,
        role:
          role === LicenseAssistantMessageRole.User
            ? 'user'
            : 'assistant',
        content,
      })),
    [conversation],
  );

  const send = useCallback(
    (message: string, onSent?: () => void) => {
      if (mutation.isPending) {
        return;
      }

      setError(null);
      setPendingMessage(message);
      mutation.mutate(
        {
          input: {
            conversation,
            // A draft the author has not written anything in yet is not one to send.
            draft: draft?.text.trim() ? draft : null,
            message,
          },
        },
        {
          onSuccess: ({ draftLicense: answer }) => {
            setConversation(answer.conversation);
            // A reply that came without a draft (the assistant could not produce one) must not wipe the one the author has.
            setDraft((current) => answer.draft ?? current);
            setDetails({
              disclaimers: answer.disclaimers,
              recommendations: answer.recommendations,
              isReadyToFinalize: answer.isReadyToFinalize,
              draftChanged: answer.draftChanged,
            });
            onSent?.();
          },
          onError: (failure) =>
            setError(toLicenseAssistantError(failure)),
          onSettled: () => setPendingMessage(null),
        },
      );
    },
    [conversation, draft, mutation],
  );

  /** @description Forget the conversation and the draft, to start another. */
  const reset = useCallback(() => {
    setConversation([]);
    setDraft(null);
    setDetails(null);
    setPendingMessage(null);
    setError(null);
  }, []);

  return {
    conversation,
    reset,
    messages,
    pendingMessage,
    isPending: mutation.isPending,
    error,
    draft,
    setDraft,
    details,
    send,
  };
}

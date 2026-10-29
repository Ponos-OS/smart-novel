import { useState } from 'react';

import { Button } from '../../components/Button';
import { useLicenseDraftQuery } from '../../generated/graphql';
import { useAuth } from '../../hooks/useAuth';
import { GraphqlRequestError } from '../../lib/graphql-fetcher';
import { AssistantWorkspace } from './AssistantWorkspace';
import { useMessages } from './i18n';
import { loadSession } from './session-storage';
import {
  type FinalizedLicense,
  type InitialSession,
  toDraftInput,
} from './use-license-assistant-session';

interface LicenseDraftingAssistantProps {
  /** @description The license of the novel being edited, which the author can customize. */
  baseLicense?: { id: string; name: string };
  /** @description Called with the license to put on the novel once the author finalizes the draft. */
  onFinalized?: (license: FinalizedLicense) => void;
}

/**
 * @description Picks up where the writer left off: the draft of the stored session is read from the backend first, and the workspace starts only once it has it. A draft that no longer exists ends the stored session.
 */
export function LicenseDraftingAssistant({
  baseLicense,
  onFinalized,
}: LicenseDraftingAssistantProps) {
  const t = useMessages();
  const { user } = useAuth();
  const [stored] = useState(() => loadSession(user?.sub ?? ''));
  const restored = useLicenseDraftQuery(
    { id: stored?.draftId ?? '' },
    { enabled: !!stored, retry: false },
  );

  if (stored && restored.isLoading) {
    return (
      <p
        role="status"
        className="text-sm text-gray-700 dark:text-gray-300"
      >
        {t('restore.loading')}
      </p>
    );
  }

  const isGone =
    restored.error instanceof GraphqlRequestError &&
    restored.error.extensions?.code === 'NOT_FOUND';

  if (stored && restored.error && !isGone) {
    return (
      <div
        role="alert"
        className="space-y-2 text-sm text-red-600 dark:text-red-400"
      >
        <p>{t('restore.failed')}</p>
        <Button
          type="button"
          variant="outline"
          color="gray"
          onClick={() => void restored.refetch()}
        >
          {t('restore.retry')}
        </Button>
      </div>
    );
  }

  const initial: InitialSession | null =
    stored && restored.data
      ? {
          draftId: stored.draftId,
          draft: toDraftInput(restored.data.licenseDraft),
          conversation: stored.conversation,
        }
      : null;

  return (
    <AssistantWorkspace
      initial={initial}
      baseLicense={baseLicense}
      onFinalized={onFinalized}
    />
  );
}

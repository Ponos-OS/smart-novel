import { useEffect, useRef, useState } from 'react';

import { Button } from '../../components/Button';
import { CanonicalLicenseDialog } from './CanonicalLicenseDialog';
import { ConversationPane } from './ConversationPane';
import { DraftPane } from './DraftPane';
import { useMessages } from './i18n';
import { StartPanel } from './StartPanel';
import {
  type FinalizedLicense,
  type InitialSession,
  useLicenseAssistantSession,
} from './use-license-assistant-session';

interface AssistantWorkspaceProps {
  initial: InitialSession | null;
  baseLicense?: { id: string; name: string };
  onFinalized?: (license: FinalizedLicense) => void;
}

export function AssistantWorkspace({
  initial,
  baseLicense,
  onFinalized,
}: AssistantWorkspaceProps) {
  const t = useMessages();
  const session = useLicenseAssistantSession({
    initial,
    onFinalized,
  });
  const { assistant } = session;
  const [composerText, setComposerText] = useState('');
  const [viewedLicenseId, setViewedLicenseId] = useState<
    string | null
  >(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const startHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousDraftId = useRef(session.draftId);

  // The view swaps under the writer, so the focus follows; a view that was there at the start keeps it.
  useEffect(() => {
    const wasOpen = !!previousDraftId.current;

    previousDraftId.current = session.draftId;
    if (wasOpen === !!session.draftId) {
      return;
    }
    (session.draftId
      ? composerRef
      : startHeadingRef
    ).current?.focus();
  }, [session.draftId]);

  // Never replaces what the author already wrote: a suggestion goes on a new line.
  const prefill = (message: string) => {
    setComposerText((text) =>
      text ? `${text}\n${message}` : message,
    );
    composerRef.current?.focus();
  };

  if (!session.draftId) {
    return (
      <StartPanel
        headingRef={startHeadingRef}
        baseLicense={baseLicense}
        isCreating={session.isCreating}
        error={session.error}
        onCreate={session.create}
        onResume={session.resume}
        onDiscard={session.discard}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          color="gray"
          onClick={session.startOver}
        >
          {t('start.startOver')}
        </Button>
        {session.error && (
          <p role="alert" className="text-sm text-red-400">
            {session.error}
          </p>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ConversationPane
          messages={assistant.messages}
          pendingMessage={assistant.pendingMessage}
          isPending={assistant.isPending}
          error={assistant.error}
          onSend={assistant.send}
          composerText={composerText}
          onComposerTextChange={setComposerText}
          composerRef={composerRef}
        />
        <DraftPane
          draft={assistant.draft}
          details={assistant.details}
          isPending={assistant.isPending}
          isFinalizing={session.isFinalizing}
          syncStatus={session.syncStatus}
          onPrefill={prefill}
          onViewLicense={setViewedLicenseId}
          onFinalize={session.finalize}
        />
      </div>
      {viewedLicenseId && (
        <CanonicalLicenseDialog
          licenseId={viewedLicenseId}
          onClose={() => setViewedLicenseId(null)}
        />
      )}
    </div>
  );
}

import { useRef, useState } from 'react';

import { CanonicalLicenseDialog } from './CanonicalLicenseDialog';
import { ConversationPane } from './ConversationPane';
import { DraftPane } from './DraftPane';
import { useLicenseAssistant } from './use-license-assistant';

export function LicenseDraftingAssistant() {
  const assistant = useLicenseAssistant();
  const [composerText, setComposerText] = useState('');
  const [viewedLicenseId, setViewedLicenseId] = useState<
    string | null
  >(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // Never replaces what the author already wrote: a suggestion goes on a new line.
  const prefill = (message: string) => {
    setComposerText((text) =>
      text ? `${text}\n${message}` : message,
    );
    composerRef.current?.focus();
  };

  return (
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
        onPrefill={prefill}
        onViewLicense={setViewedLicenseId}
      />
      {viewedLicenseId && (
        <CanonicalLicenseDialog
          licenseId={viewedLicenseId}
          onClose={() => setViewedLicenseId(null)}
        />
      )}
    </div>
  );
}

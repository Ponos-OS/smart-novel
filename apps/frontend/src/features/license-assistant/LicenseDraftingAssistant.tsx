import { ConversationPane } from './ConversationPane';
import { DraftPane } from './DraftPane';
import { useLicenseAssistant } from './use-license-assistant';

export function LicenseDraftingAssistant() {
  const assistant = useLicenseAssistant();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ConversationPane
        messages={assistant.messages}
        pendingMessage={assistant.pendingMessage}
        isPending={assistant.isPending}
        error={assistant.error}
        onSend={assistant.send}
      />
      <DraftPane
        draft={assistant.draft}
        details={assistant.details}
        isPending={assistant.isPending}
      />
    </div>
  );
}

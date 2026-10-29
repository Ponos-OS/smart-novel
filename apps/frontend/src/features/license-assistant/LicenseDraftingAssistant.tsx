import { ConversationPane } from './ConversationPane';
import { useLicenseAssistant } from './use-license-assistant';

export function LicenseDraftingAssistant() {
  const assistant = useLicenseAssistant();

  return (
    <ConversationPane
      messages={assistant.messages}
      pendingMessage={assistant.pendingMessage}
      isPending={assistant.isPending}
      error={assistant.error}
      onSend={assistant.send}
    />
  );
}

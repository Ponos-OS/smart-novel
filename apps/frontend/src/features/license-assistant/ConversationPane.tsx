import type { LicenseAssistantError } from './license-assistant-error';
import type { ConversationMessage } from './use-license-assistant';

import { Composer } from './Composer';
import { MessageList } from './MessageList';

interface ConversationPaneProps {
  messages: ConversationMessage[];
  pendingMessage: string | null;
  isPending: boolean;
  error: LicenseAssistantError | null;
  onSend: (message: string, onSent: () => void) => void;
}

export function ConversationPane({
  messages,
  pendingMessage,
  isPending,
  error,
  onSend,
}: ConversationPaneProps) {
  return (
    <section
      aria-label="Conversation"
      aria-busy={isPending}
      className="flex min-h-[24rem] flex-col rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
    >
      <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-white">
        Conversation
      </h2>
      <MessageList
        messages={messages}
        pendingMessage={pendingMessage}
      />
      {error && (
        <p
          role="alert"
          className="mt-3 text-sm text-red-600 dark:text-red-400"
        >
          {error.message}
          {error.requestId && ` (reference: ${error.requestId})`}
        </p>
      )}
      <Composer isPending={isPending} onSend={onSend} />
    </section>
  );
}

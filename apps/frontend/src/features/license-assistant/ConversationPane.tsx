import type { Ref } from 'react';

import type { LicenseAssistantError } from './license-assistant-error';
import type { ConversationMessage } from './use-license-assistant';

import { Composer } from './Composer';
import { useMessages } from './i18n';
import { MessageList } from './MessageList';

interface ConversationPaneProps {
  composerText: string;
  onComposerTextChange: (text: string) => void;
  composerRef?: Ref<HTMLTextAreaElement>;
  messages: ConversationMessage[];
  pendingMessage: string | null;
  isPending: boolean;
  error: LicenseAssistantError | null;
  onSend: (message: string, onSent: () => void) => void;
}

export function ConversationPane({
  composerText,
  onComposerTextChange,
  composerRef,
  messages,
  pendingMessage,
  isPending,
  error,
  onSend,
}: ConversationPaneProps) {
  const t = useMessages();

  return (
    <section
      aria-label={t('conversation.title')}
      aria-busy={isPending}
      className="flex min-h-[24rem] flex-col rounded-lg border p-4 border-gray-700 bg-gray-800"
    >
      <h2 className="mb-3 text-lg font-bold text-white">
        {t('conversation.title')}
      </h2>
      <MessageList
        messages={messages}
        pendingMessage={pendingMessage}
      />
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error.requestId
            ? t('error.reference', {
                message: t(error.messageKey),
                requestId: error.requestId,
              })
            : t(error.messageKey)}
        </p>
      )}
      <Composer
        text={composerText}
        onTextChange={onComposerTextChange}
        textareaRef={composerRef}
        isPending={isPending}
        onSend={onSend}
      />
    </section>
  );
}

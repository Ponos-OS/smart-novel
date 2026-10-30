import type { ConversationMessage } from './use-license-assistant';

import { useMessages } from './i18n';

interface MessageListProps {
  messages: ConversationMessage[];
  /** @description What the author just sent, while the answer is on its way. */
  pendingMessage?: string | null;
}

export function MessageList({
  messages,
  pendingMessage,
}: MessageListProps) {
  const t = useMessages();

  return (
    <div
      role="log"
      aria-label={t('conversation.log')}
      className="min-h-0 flex-1 overflow-y-auto"
    >
      <ol className="flex flex-col gap-3">
        {messages.map((message) => (
          <Message
            key={message.id}
            author={message.role}
            content={message.content}
          />
        ))}
        {pendingMessage && (
          <Message author="user" content={pendingMessage} isSending />
        )}
      </ol>
    </div>
  );
}

function Message({
  author,
  content,
  isSending = false,
}: {
  author: ConversationMessage['role'];
  content: string;
  isSending?: boolean;
}) {
  const t = useMessages();
  const isUser = author === 'user';
  let label = t(isUser ? 'message.you' : 'message.assistant');

  if (isSending) {
    label = t('message.youSending');
  }

  return (
    <li
      className={`max-w-[85%] rounded-lg border px-3 py-2 text-sm ${
        isUser
          ? 'self-end border-blue-800 bg-blue-950 text-gray-100'
          : 'self-start border-gray-700 bg-gray-800 text-gray-100'
      }`}
    >
      <span className="mb-1 block text-xs font-semibold text-gray-400">
        {label}
      </span>
      <span className="whitespace-pre-wrap">{content}</span>
    </li>
  );
}

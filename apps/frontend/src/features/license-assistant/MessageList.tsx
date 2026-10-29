import type { ConversationMessage } from './use-license-assistant';

interface MessageListProps {
  messages: ConversationMessage[];
  /** @description What the author just sent, while the answer is on its way. */
  pendingMessage?: string | null;
}

const LABEL: Record<ConversationMessage['role'], string> = {
  user: 'You',
  assistant: 'Assistant',
};

export function MessageList({
  messages,
  pendingMessage,
}: MessageListProps) {
  return (
    <div
      role="log"
      aria-label="Conversation with the license assistant"
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
  const isUser = author === 'user';

  return (
    <li
      className={`max-w-[85%] rounded-lg border px-3 py-2 text-sm ${
        isUser
          ? 'self-end border-blue-200 bg-blue-50 text-gray-900 dark:border-blue-800 dark:bg-blue-950 dark:text-gray-100'
          : 'self-start border-gray-200 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'
      }`}
    >
      <span className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400">
        {LABEL[author]}
        {isSending && ' (sending...)'}
      </span>
      <span className="whitespace-pre-wrap">{content}</span>
    </li>
  );
}

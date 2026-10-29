import { LICENSE_ASSISTANT_MESSAGE_MAX_LENGTH } from '@smart-novel/shared';
import { type KeyboardEvent, useId, useState } from 'react';

import { Button } from '../../components/Button';

interface ComposerProps {
  isPending: boolean;
  /** @description Called with the trimmed message; `onSent` clears the box, so a failed send keeps what the author wrote. */
  onSend: (message: string, onSent: () => void) => void;
}

export function Composer({ isPending, onSend }: ComposerProps) {
  const [text, setText] = useState('');
  const hintId = useId();
  const message = text.trim();
  const isTooLong =
    text.length > LICENSE_ASSISTANT_MESSAGE_MAX_LENGTH;
  const canSend = !isPending && message.length > 0 && !isTooLong;

  const send = () => {
    if (!canSend) {
      return;
    }

    onSend(message, () => setText(''));
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    send();
  };

  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Your message
        </span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isPending}
          rows={3}
          aria-describedby={hintId}
          aria-invalid={isTooLong}
          placeholder="Tell the assistant how others may use your novel"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        />
      </label>
      <div className="flex items-center justify-between gap-3">
        <p
          id={hintId}
          className={`text-xs ${
            isTooLong
              ? 'font-semibold text-red-600 dark:text-red-400'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          {text.length} / {LICENSE_ASSISTANT_MESSAGE_MAX_LENGTH}
          {isTooLong && ' - too long, shorten it to send'}
          {!isTooLong && ' - Enter sends, Shift+Enter adds a line'}
        </p>
        <Button
          type="submit"
          variant="solid"
          color="blue"
          disabled={!canSend}
        >
          {isPending ? 'Sending...' : 'Send'}
        </Button>
      </div>
    </form>
  );
}

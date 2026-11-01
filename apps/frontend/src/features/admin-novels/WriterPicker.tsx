import { X } from 'lucide-react';
import { useId, useState } from 'react';

import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { type PickedWriter } from './novel-filters';
import { useWriterSuggestions } from './use-writer-suggestions';

interface WriterPickerProps {
  value: PickedWriter[];
  onChange: (writers: PickedWriter[]) => void;
}

const SEARCH_DEBOUNCE_MS = 300;

function WriterDetails({ writer }: { writer: PickedWriter }) {
  return (
    <span className="flex flex-col">
      <span className="font-medium">{writer.penName}</span>
      <span className="text-xs text-gray-400">
        {[writer.name, writer.email].filter(Boolean).join(' · ')}
      </span>
    </span>
  );
}

/**
 * @description
 * Finds writers by pen name and lets the admin pick several. Every suggestion shows the pen name, the real name and the email, so the admin sees whom they pick; only the `userId`s of the picks reach the query.
 */
export function WriterPicker({ value, onChange }: WriterPickerProps) {
  const id = useId();
  const listboxId = `${id}-listbox`;
  const [text, setText] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const search = useDebouncedValue(text.trim(), SEARCH_DEBOUNCE_MS);
  const suggestions = useWriterSuggestions(search, isOpen);
  const options = suggestions.writers.filter(
    ({ userId }) => !value.some((picked) => picked.userId === userId),
  );
  const isSettled = search === text.trim();
  const activeOption = options[activeIndex];

  const select = (writer: PickedWriter) => {
    onChange([...value, writer]);
    setText('');
    setActiveIndex(0);
  };

  const remove = (userId: string) => {
    onChange(value.filter((writer) => writer.userId !== userId));
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) =>
        options.length === 0 ? 0 : (index + 1) % options.length,
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) =>
        options.length === 0
          ? 0
          : (index - 1 + options.length) % options.length,
      );
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (isOpen && activeOption) {
        select(activeOption);
      }
      return;
    }

    if (event.key === 'Escape' && isOpen) {
      event.stopPropagation();
      setIsOpen(false);
      return;
    }

    if (
      event.key === 'Backspace' &&
      text === '' &&
      value.length > 0
    ) {
      remove(value[value.length - 1].userId);
    }
  };

  return (
    <div className="relative">
      {value.length > 0 && (
        <ul
          aria-label="Selected writers"
          className="mb-2 flex flex-wrap gap-2"
        >
          {value.map((writer) => (
            <li
              key={writer.userId}
              className="flex items-center gap-1 rounded-full bg-blue-900 py-1 pl-3 pr-1 text-sm text-blue-200"
            >
              <span>{writer.penName}</span>
              <button
                type="button"
                aria-label={`Remove ${writer.penName}`}
                onClick={() => remove(writer.userId)}
                className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full text-blue-200 transition-colors hover:bg-blue-800"
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        type="text"
        role="combobox"
        aria-label="Writers"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          isOpen && activeOption
            ? `${id}-option-${activeIndex}`
            : undefined
        }
        value={text}
        placeholder="Search writers by pen name"
        autoComplete="off"
        onChange={(event) => {
          setText(event.target.value);
          setActiveIndex(0);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onKeyDown={handleKeyDown}
        className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white"
      />

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-600 bg-gray-800 shadow-lg">
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Writer suggestions"
            className="max-h-60 overflow-y-auto py-1"
          >
            {options.map((writer, index) => (
              <li
                key={writer.userId}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                // mousedown, not click: the input would lose focus and close the list first.
                onMouseDown={(event) => {
                  event.preventDefault();
                  select(writer);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  index === activeIndex
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-300'
                }`}
              >
                <WriterDetails writer={writer} />
              </li>
            ))}
          </ul>

          {(suggestions.isLoading || !isSettled) && (
            <p
              role="status"
              className="px-3 py-2 text-sm text-gray-400"
            >
              Searching...
            </p>
          )}
          {suggestions.isError && (
            <p
              role="alert"
              className="px-3 py-2 text-sm text-red-300"
            >
              Could not load writers.
            </p>
          )}
          {isSettled &&
            !suggestions.isLoading &&
            !suggestions.isError &&
            options.length === 0 &&
            !suggestions.hasMore && (
              <p className="px-3 py-2 text-sm text-gray-400">
                {text.trim()
                  ? `No writer has a pen name with "${text.trim()}".`
                  : 'No more writers to pick.'}
              </p>
            )}
          {isSettled && suggestions.hasMore && (
            <button
              type="button"
              disabled={suggestions.isLoadingMore}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => suggestions.loadMore()}
              className="w-full cursor-pointer border-t border-gray-700 px-3 py-2 text-left text-sm text-blue-300 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {suggestions.isLoadingMore ? 'Loading...' : 'More'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

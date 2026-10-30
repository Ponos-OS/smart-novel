import { useId, useState } from 'react';

import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useCategorySuggestions } from './use-category-suggestions';

interface CategoryPickerProps {
  value: string[];
  onChange: (categories: string[]) => void;
  disabled?: boolean;
  /** @description Offered when nothing matches the typed text; the picker never creates a category itself. */
  onRequestCategory?: (name: string) => void;
}

const SEARCH_DEBOUNCE_MS = 300;

export function CategoryPicker({
  value,
  onChange,
  disabled,
  onRequestCategory,
}: CategoryPickerProps) {
  const id = useId();
  const listboxId = `${id}-listbox`;
  const [text, setText] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const search = useDebouncedValue(
    text.trim().toLowerCase(),
    SEARCH_DEBOUNCE_MS,
  );
  const suggestions = useCategorySuggestions(search, isOpen);
  const options = suggestions.names.filter(
    (name) => !value.includes(name),
  );
  const isSettled = search === text.trim().toLowerCase();
  const hasNoMatch =
    isSettled &&
    !suggestions.isLoading &&
    !suggestions.isError &&
    options.length === 0 &&
    !suggestions.hasMore &&
    text.trim().length > 0;
  const activeOption = options[activeIndex];

  const select = (name: string) => {
    onChange([...value, name]);
    setText('');
    setActiveIndex(0);
  };

  const remove = (name: string) => {
    onChange(value.filter((category) => category !== name));
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
      // Enter inside the input must never submit the novel form.
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
      remove(value[value.length - 1]);
    }
  };

  return (
    <div className="relative">
      {value.length > 0 && (
        <ul
          aria-label="Selected categories"
          className="mb-2 flex flex-wrap gap-2"
        >
          {value.map((name) => (
            <li
              key={name}
              className="flex items-center gap-1 rounded-full bg-blue-900 py-1 pl-3 pr-1 text-sm text-blue-200"
            >
              <span className="capitalize">{name}</span>
              <button
                type="button"
                aria-label={`Remove ${name}`}
                disabled={disabled}
                onClick={() => remove(name)}
                className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full text-blue-200 transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-3.5 w-3.5"
                >
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        type="text"
        role="combobox"
        aria-label="Categories"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          isOpen && activeOption
            ? `${id}-option-${activeIndex}`
            : undefined
        }
        value={text}
        disabled={disabled}
        placeholder="Search categories"
        autoComplete="off"
        onChange={(event) => {
          setText(event.target.value);
          setActiveIndex(0);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onKeyDown={handleKeyDown}
        className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-white disabled:opacity-50"
      />

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-600 bg-gray-800 shadow-lg">
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Category suggestions"
            className="max-h-60 overflow-y-auto py-1"
          >
            {options.map((name, index) => (
              <li
                key={name}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                // mousedown, not click: the input would lose focus and close the list first.
                onMouseDown={(event) => {
                  event.preventDefault();
                  select(name);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={`cursor-pointer px-3 py-2 text-sm capitalize ${
                  index === activeIndex
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-300'
                }`}
              >
                {name}
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
              Could not load categories.
            </p>
          )}
          {hasNoMatch && (
            <div className="space-y-2 px-3 py-2 text-sm text-gray-300">
              <p>No category matches &quot;{text.trim()}&quot;.</p>
              {onRequestCategory && (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onRequestCategory(text.trim())}
                  className="cursor-pointer font-medium text-blue-300 hover:text-blue-200"
                >
                  Request category
                </button>
              )}
            </div>
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

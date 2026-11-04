import { Toggle } from 'radix-ui';

import { Tooltip } from '../../components/Tooltip';

export interface FilterTag {
  name: string;
  /** @description An estimate from the database planner, never an exact count. Missing for a selected tag the search no longer lists. */
  approximateNovelCount?: number;
}

interface TagFilterProps {
  availableTags: FilterTag[];
  includeTags: string[];
  excludeTags: string[];
  onToggleInclude: (tag: string) => void;
  onToggleExclude: (tag: string) => void;
  searchText?: string;
  onSearchTextChange?: (text: string) => void;
  isSearching?: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onShowMore?: () => void;
}

const countFormat = new Intl.NumberFormat('en-US', {
  notation: 'compact',
});

interface TagChipProps {
  tag: FilterTag;
  isSelected: boolean;
  selectedClasses: string;
  onToggle: () => void;
}

function TagChip({
  tag,
  isSelected,
  selectedClasses,
  onToggle,
}: TagChipProps) {
  return (
    <Tooltip content="About how many novels have this tag">
      <Toggle.Root
        pressed={isSelected}
        onPressedChange={onToggle}
        className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 ${
          isSelected
            ? selectedClasses
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
      >
        {tag.name}
        {tag.approximateNovelCount !== undefined && (
          <span className="ml-2 text-xs opacity-70">
            ~{countFormat.format(tag.approximateNovelCount)}
          </span>
        )}
      </Toggle.Root>
    </Tooltip>
  );
}

export function TagFilter({
  availableTags,
  includeTags,
  excludeTags,
  onToggleInclude,
  onToggleExclude,
  searchText = '',
  onSearchTextChange,
  isSearching = false,
  hasMore = false,
  isLoadingMore = false,
  onShowMore,
}: TagFilterProps) {
  return (
    <div className="space-y-6">
      {onSearchTextChange && (
        <div>
          <input
            type="search"
            aria-label="Search tags"
            placeholder="Search tags"
            value={searchText}
            onChange={(event) =>
              onSearchTextChange(event.target.value)
            }
            className="w-full max-w-sm rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white"
          />
          {isSearching && (
            <p role="status" className="mt-2 text-xs text-gray-400">
              Searching...
            </p>
          )}
        </div>
      )}

      {/* Include Tags */}
      <div>
        <h3 className="mb-3 text-lg font-semibold text-white">
          Include Tags
        </h3>
        <div className="flex flex-wrap gap-2">
          {availableTags.map((tag) => (
            <TagChip
              key={`include-${tag.name}`}
              tag={tag}
              isSelected={includeTags.includes(tag.name)}
              selectedClasses="bg-green-600 text-white hover:bg-green-700"
              onToggle={() => onToggleInclude(tag.name)}
            />
          ))}
        </div>
      </div>

      {/* Exclude Tags */}
      <div>
        <h3 className="mb-3 text-lg font-semibold text-white">
          Exclude Tags
        </h3>
        <div className="flex flex-wrap gap-2">
          {availableTags.map((tag) => (
            <TagChip
              key={`exclude-${tag.name}`}
              tag={tag}
              isSelected={excludeTags.includes(tag.name)}
              selectedClasses="bg-red-600 text-white hover:bg-red-700"
              onToggle={() => onToggleExclude(tag.name)}
            />
          ))}
        </div>
      </div>

      {hasMore && (
        <button
          type="button"
          disabled={isLoadingMore}
          onClick={onShowMore}
          className="cursor-pointer rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoadingMore ? 'Loading...' : 'Show more tags'}
        </button>
      )}
    </div>
  );
}

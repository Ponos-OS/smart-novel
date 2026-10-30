import { Toggle } from 'radix-ui';

import { Tooltip } from '../../components/Tooltip';

export interface FilterCategory {
  name: string;
  /** @description An estimate from the database planner, never an exact count. Missing for a selected category the search no longer lists. */
  approximateNovelCount?: number;
}

interface CategoryFilterProps {
  availableCategories: FilterCategory[];
  includeCategories: string[];
  excludeCategories: string[];
  onToggleInclude: (category: string) => void;
  onToggleExclude: (category: string) => void;
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

interface CategoryChipProps {
  category: FilterCategory;
  isSelected: boolean;
  selectedClasses: string;
  onToggle: () => void;
}

function CategoryChip({
  category,
  isSelected,
  selectedClasses,
  onToggle,
}: CategoryChipProps) {
  return (
    <Tooltip content="About how many novels have this category">
      <Toggle.Root
        pressed={isSelected}
        onPressedChange={onToggle}
        className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 ${
          isSelected
            ? selectedClasses
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
      >
        {category.name}
        {category.approximateNovelCount !== undefined && (
          <span className="ml-2 text-xs opacity-70">
            ~{countFormat.format(category.approximateNovelCount)}
          </span>
        )}
      </Toggle.Root>
    </Tooltip>
  );
}

export function CategoryFilter({
  availableCategories,
  includeCategories,
  excludeCategories,
  onToggleInclude,
  onToggleExclude,
  searchText = '',
  onSearchTextChange,
  isSearching = false,
  hasMore = false,
  isLoadingMore = false,
  onShowMore,
}: CategoryFilterProps) {
  return (
    <div className="space-y-6">
      {onSearchTextChange && (
        <div>
          <input
            type="search"
            aria-label="Search categories"
            placeholder="Search categories"
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

      {/* Include Categories */}
      <div>
        <h3 className="mb-3 text-lg font-semibold text-white">
          Include Categories
        </h3>
        <div className="flex flex-wrap gap-2">
          {availableCategories.map((category) => (
            <CategoryChip
              key={`include-${category.name}`}
              category={category}
              isSelected={includeCategories.includes(category.name)}
              selectedClasses="bg-green-600 text-white hover:bg-green-700"
              onToggle={() => onToggleInclude(category.name)}
            />
          ))}
        </div>
      </div>

      {/* Exclude Categories */}
      <div>
        <h3 className="mb-3 text-lg font-semibold text-white">
          Exclude Categories
        </h3>
        <div className="flex flex-wrap gap-2">
          {availableCategories.map((category) => (
            <CategoryChip
              key={`exclude-${category.name}`}
              category={category}
              isSelected={excludeCategories.includes(category.name)}
              selectedClasses="bg-red-600 text-white hover:bg-red-700"
              onToggle={() => onToggleExclude(category.name)}
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
          {isLoadingMore ? 'Loading...' : 'Show more categories'}
        </button>
      )}
    </div>
  );
}

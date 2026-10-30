export interface FilterCategory {
  name: string;
  /** @description An estimate from the database planner, never an exact count. */
  approximateNovelCount: number;
}

interface CategoryFilterProps {
  availableCategories: FilterCategory[];
  includeCategories: string[];
  excludeCategories: string[];
  onToggleInclude: (category: string) => void;
  onToggleExclude: (category: string) => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onShowMore?: () => void;
}

const countFormat = new Intl.NumberFormat('en-US', {
  notation: 'compact',
});

export function CategoryFilter({
  availableCategories,
  includeCategories,
  excludeCategories,
  onToggleInclude,
  onToggleExclude,
  hasMore = false,
  isLoadingMore = false,
  onShowMore,
}: CategoryFilterProps) {
  return (
    <div className="space-y-6">
      {/* Include Categories */}
      <div>
        <h3 className="mb-3 text-lg font-semibold text-white">
          Include Categories
        </h3>
        <div className="flex flex-wrap gap-2">
          {availableCategories.map(
            ({ name: category, approximateNovelCount }) => {
              const isSelected = includeCategories.includes(category);
              return (
                <button
                  key={`include-${category}`}
                  onClick={() => onToggleInclude(category)}
                  className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {category}
                  <span
                    className="ml-2 text-xs opacity-70"
                    title="About how many novels have this category"
                  >
                    ~{countFormat.format(approximateNovelCount)}
                  </span>
                </button>
              );
            },
          )}
        </div>
      </div>

      {/* Exclude Categories */}
      <div>
        <h3 className="mb-3 text-lg font-semibold text-white">
          Exclude Categories
        </h3>
        <div className="flex flex-wrap gap-2">
          {availableCategories.map(
            ({ name: category, approximateNovelCount }) => {
              const isSelected = excludeCategories.includes(category);
              return (
                <button
                  key={`exclude-${category}`}
                  onClick={() => onToggleExclude(category)}
                  className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {category}
                  <span
                    className="ml-2 text-xs opacity-70"
                    title="About how many novels have this category"
                  >
                    ~{countFormat.format(approximateNovelCount)}
                  </span>
                </button>
              );
            },
          )}
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

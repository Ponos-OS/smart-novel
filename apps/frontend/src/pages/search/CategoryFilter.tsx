interface CategoryFilterProps {
  availableCategories: string[];
  includeCategories: string[];
  excludeCategories: string[];
  onToggleInclude: (category: string) => void;
  onToggleExclude: (category: string) => void;
}

export function CategoryFilter({
  availableCategories,
  includeCategories,
  excludeCategories,
  onToggleInclude,
  onToggleExclude,
}: CategoryFilterProps) {
  return (
    <div className="space-y-6">
      {/* Include Categories */}
      <div>
        <h3 className="mb-3 text-lg font-semibold text-white">
          Include Categories
        </h3>
        <div className="flex flex-wrap gap-2">
          {availableCategories.map((category) => {
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
              </button>
            );
          })}
        </div>
      </div>

      {/* Exclude Categories */}
      <div>
        <h3 className="mb-3 text-lg font-semibold text-white">
          Exclude Categories
        </h3>
        <div className="flex flex-wrap gap-2">
          {availableCategories.map((category) => {
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
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

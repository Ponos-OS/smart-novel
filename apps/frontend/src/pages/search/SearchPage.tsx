import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { NovelCard } from '../../components/NovelCard';
import {
  NovelFiltersInput,
  useGetCategoriesQuery,
  useSearchNovelsQuery,
} from '../../generated/graphql';
import { CategoryFilter } from './CategoryFilter';

const capitalizeCategory = (category: string): string => {
  return category.charAt(0).toUpperCase() + category.slice(1);
};

function getInitialIncludeCategories(
  searchParams: URLSearchParams,
): string[] {
  const categoryParam = searchParams.get('category');
  return categoryParam ? [categoryParam] : [];
}

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const [includeCategories, setIncludeCategories] = useState<
    string[]
  >(() => getInitialIncludeCategories(searchParams));
  const [excludeCategories, setExcludeCategories] = useState<
    string[]
  >([]);
  const [filters, setFilters] = useState<
    NovelFiltersInput | undefined
  >(undefined);
  const [searchTriggered, setSearchTriggered] = useState(false);

  const {
    data: categoriesData,
    isLoading: categoriesLoading,
    error: categoriesError,
  } = useGetCategoriesQuery({});

  const {
    data: searchData,
    isLoading: searchLoading,
    error: searchError,
  } = useSearchNovelsQuery({ filters }, { enabled: searchTriggered });

  const handleSearch = () => {
    const newFilters: NovelFiltersInput = {
      category: {
        ...(includeCategories.length > 0 && {
          in: includeCategories,
        }),
        ...(excludeCategories.length > 0 && {
          nin: excludeCategories,
        }),
      },
    };
    setFilters(newFilters);
    setSearchTriggered(true);
  };

  const handleToggleInclude = (category: string) => {
    setIncludeCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category],
    );
  };

  const handleToggleExclude = (category: string) => {
    setExcludeCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category],
    );
  };

  const novels =
    searchData?.novelsConnection?.edges.map((edge) => edge.node) ??
    [];

  // Transform categories from lowercase to capitalized for display
  const availableCategories = (categoriesData?.categories ?? []).map(
    capitalizeCategory,
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-3xl font-bold text-white">
        Search Novels
      </h1>

      {/* Filter Section */}
      <div className="mb-8 rounded-lg border p-6 border-gray-700 bg-gray-800">
        {categoriesLoading ? (
          <div className="text-center text-gray-400">
            <p>Loading categories...</p>
          </div>
        ) : categoriesError ? (
          <div className="text-center text-red-400">
            <p>Failed to load categories</p>
          </div>
        ) : (
          <CategoryFilter
            availableCategories={availableCategories}
            includeCategories={includeCategories}
            excludeCategories={excludeCategories}
            onToggleInclude={handleToggleInclude}
            onToggleExclude={handleToggleExclude}
          />
        )}

        {/* Search Button */}
        <div className="mt-6">
          <button
            onClick={handleSearch}
            disabled={searchLoading}
            className="cursor-pointer rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {searchLoading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Results Section */}
      {searchLoading && !searchData ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="text-center">
            <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <p className="text-gray-400">Searching...</p>
          </div>
        </div>
      ) : searchError ? (
        <div className="text-center text-red-400">
          <p>Failed to search novels</p>
        </div>
      ) : searchTriggered && searchData ? (
        <div>
          <h2 className="mb-4 text-xl font-semibold text-white">
            Results ({novels.length})
          </h2>
          {novels.length === 0 ? (
            <div className="text-center text-gray-400">
              <p>No novels found matching your criteria.</p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-1">
              {novels.map((novel) => (
                <NovelCard key={novel.id} novel={novel} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center text-gray-400">
          <p>Select categories and click "Search" to find novels.</p>
        </div>
      )}
    </div>
  );
}

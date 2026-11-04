import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { NovelCard } from '../../components/NovelCard';
import {
  NovelFiltersInput,
  useSearchNovelsQuery,
} from '../../generated/graphql';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { showApiError } from '../../utils/notification';
import { TagFilter } from './TagFilter';
import { useFilterTags } from './use-filter-tags';

const TAG_SEARCH_DEBOUNCE_MS = 300;

const capitalizeTag = (tag: string): string => {
  return tag.charAt(0).toUpperCase() + tag.slice(1);
};

function getInitialIncludeTags(
  searchParams: URLSearchParams,
): string[] {
  const tagParam = searchParams.get('tag');
  return tagParam ? [tagParam] : [];
}

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const [includeTags, setIncludeTags] = useState<string[]>(() =>
    getInitialIncludeTags(searchParams),
  );
  const [excludeTags, setExcludeTags] = useState<string[]>([]);
  const [filters, setFilters] = useState<
    NovelFiltersInput | undefined
  >(undefined);
  const [searchTriggered, setSearchTriggered] = useState(false);

  const [tagSearch, setTagSearch] = useState('');
  // The request waits until the user pauses typing.
  const debouncedTagSearch = useDebouncedValue(
    tagSearch.trim(),
    TAG_SEARCH_DEBOUNCE_MS,
  );
  const tags = useFilterTags(debouncedTagSearch);

  useEffect(() => {
    if (tags.isError) {
      showApiError('The tags could not be loaded. Try again later.');
    }
  }, [tags.isError]);

  const {
    data: searchData,
    isLoading: searchLoading,
    error: searchError,
  } = useSearchNovelsQuery({ filters }, { enabled: searchTriggered });

  const handleSearch = () => {
    const newFilters: NovelFiltersInput = {
      tags: {
        ...(includeTags.length > 0 && {
          in: includeTags,
        }),
        ...(excludeTags.length > 0 && {
          nin: excludeTags,
        }),
      },
    };
    setFilters(newFilters);
    setSearchTriggered(true);
  };

  const handleToggleInclude = (tag: string) => {
    setIncludeTags((prev) =>
      prev.includes(tag)
        ? prev.filter((c) => c !== tag)
        : [...prev, tag],
    );
  };

  const handleToggleExclude = (tag: string) => {
    setExcludeTags((prev) =>
      prev.includes(tag)
        ? prev.filter((c) => c !== tag)
        : [...prev, tag],
    );
  };

  const novels =
    searchData?.novelsConnection?.edges.map((edge) => edge.node) ??
    [];

  // Transform tags from lowercase to capitalized for display
  const listedTags = tags.tags.map(
    ({ name, approximateNovelCount }) => ({
      name: capitalizeTag(name),
      approximateNovelCount,
    }),
  );
  // A tag picked earlier stays visible when a later search no longer lists it.
  const listedNames = new Set(listedTags.map(({ name }) => name));
  const hiddenSelected = [
    ...new Set([...includeTags, ...excludeTags]),
  ]
    .filter((name) => !listedNames.has(name))
    .map((name) => ({ name }));
  const availableTags = [...hiddenSelected, ...listedTags];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-3xl font-bold text-white">
        Search Novels
      </h1>

      {/* Filter Section */}
      <div className="mb-8 rounded-xl border border-gray-700/70 bg-gray-800 p-6">
        {tags.isLoading ? (
          <div className="text-center text-gray-400">
            <p>Loading tags...</p>
          </div>
        ) : (
          <TagFilter
            availableTags={availableTags}
            includeTags={includeTags}
            excludeTags={excludeTags}
            onToggleInclude={handleToggleInclude}
            onToggleExclude={handleToggleExclude}
            searchText={tagSearch}
            onSearchTextChange={setTagSearch}
            isSearching={tags.isFetching && !tags.isLoadingMore}
            hasMore={tags.hasMore}
            isLoadingMore={tags.isLoadingMore}
            onShowMore={() => tags.loadMore()}
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
          <p>Select tags and click "Search" to find novels.</p>
        </div>
      )}
    </div>
  );
}

import { useInfiniteQuery } from '@tanstack/react-query';

import { useSearchCategoriesQuery } from '../../generated/graphql';
import { useResetOnInvalidCursor } from '../../hooks/useResetOnInvalidCursor';

const SUGGESTIONS_PAGE_SIZE = 10;

export function useCategorySuggestions(
  search: string,
  enabled: boolean,
) {
  const queryKey = ['SearchCategoriesInfinite', search];
  const query = useInfiniteQuery({
    queryKey,
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      useSearchCategoriesQuery.fetcher({
        search: search || null,
        first: SUGGESTIONS_PAGE_SIZE,
        after: pageParam,
      })(),
    getNextPageParam: ({ categoriesConnection }) =>
      categoriesConnection.pageInfo.hasNextPage
        ? categoriesConnection.pageInfo.endCursor
        : undefined,
  });

  useResetOnInvalidCursor(queryKey, query.error);

  return {
    names: (query.data?.pages ?? []).flatMap((page) =>
      page.categoriesConnection.edges.map(({ node }) => node.name),
    ),
    isLoading: query.isLoading,
    isError: query.isError,
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => query.fetchNextPage(),
  };
}

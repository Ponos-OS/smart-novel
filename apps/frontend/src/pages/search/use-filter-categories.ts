import {
  keepPreviousData,
  useInfiniteQuery,
} from '@tanstack/react-query';

import { useFilterCategoriesQuery } from '../../generated/graphql';

const PAGE_SIZE = 100;
const FRESH_FOR_MS = 30_000;

/**
 * @description
 * The categories whose name contains `search`, a page at a time. The caller debounces what the user types; the query is cached per text, so typing back to something already searched costs no request, and the list stays on screen while the next text loads.
 */
export function useFilterCategories(search: string) {
  const query = useInfiniteQuery({
    queryKey: ['FilterCategoriesInfinite', search],
    initialPageParam: undefined as string | undefined,
    staleTime: FRESH_FOR_MS,
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam }) =>
      useFilterCategoriesQuery.fetcher({
        search: search || null,
        first: PAGE_SIZE,
        after: pageParam,
      })(),
    getNextPageParam: ({ categoriesConnection }) =>
      categoriesConnection.pageInfo.hasNextPage
        ? categoriesConnection.pageInfo.endCursor
        : undefined,
  });

  return {
    categories: (query.data?.pages ?? []).flatMap((page) =>
      page.categoriesConnection.edges.map(({ node }) => node),
    ),
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => query.fetchNextPage(),
  };
}

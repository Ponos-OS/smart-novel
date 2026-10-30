import { useInfiniteQuery } from '@tanstack/react-query';

import { useFilterCategoriesQuery } from '../../generated/graphql';

const PAGE_SIZE = 30;

export function useFilterCategories() {
  const query = useInfiniteQuery({
    queryKey: ['FilterCategoriesInfinite'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      useFilterCategoriesQuery.fetcher({
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
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => query.fetchNextPage(),
  };
}

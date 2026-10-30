import { useInfiniteQuery } from '@tanstack/react-query';

import {
  CategoryStatus,
  useAdminCategoriesQuery,
} from '../../generated/graphql';

const PAGE_SIZE = 20;

export const ADMIN_CATEGORIES_KEY = 'AdminCategoriesInfinite';

export function useAdminCategories(
  search: string,
  statuses: CategoryStatus[],
  enabled: boolean,
) {
  const query = useInfiniteQuery({
    queryKey: [ADMIN_CATEGORIES_KEY, search, statuses],
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      useAdminCategoriesQuery.fetcher({
        search: search || null,
        statuses,
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

import { useInfiniteQuery } from '@tanstack/react-query';

import {
  type NovelFiltersInput,
  type NovelOrderByInput,
  useAdminNovelsQuery,
} from '../../generated/graphql';
import { useResetOnInvalidCursor } from '../../hooks/useResetOnInvalidCursor';

const PAGE_SIZE = 20;

export const ADMIN_NOVELS_KEY = 'AdminNovelsInfinite';

export function useAdminNovels(
  filters: NovelFiltersInput | undefined,
  orderBy: NovelOrderByInput | undefined,
  enabled: boolean,
) {
  const queryKey = [ADMIN_NOVELS_KEY, filters, orderBy];
  const query = useInfiniteQuery({
    queryKey,
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      useAdminNovelsQuery.fetcher({
        filters,
        orderBy,
        first: PAGE_SIZE,
        after: pageParam,
      })(),
    getNextPageParam: ({ novelsConnection }) =>
      novelsConnection.pageInfo.hasNextPage
        ? novelsConnection.pageInfo.endCursor
        : undefined,
  });

  useResetOnInvalidCursor(queryKey, query.error);

  return {
    novels: (query.data?.pages ?? []).flatMap((page) =>
      page.novelsConnection.edges.map(({ node }) => node),
    ),
    isLoading: query.isLoading,
    isError: query.isError,
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => query.fetchNextPage(),
  };
}

import { useInfiniteQuery } from '@tanstack/react-query';

import {
  type NovelOrder,
  useAdminNovelsQuery,
} from '../../generated/graphql';
import { useResetOnInvalidCursor } from '../../hooks/useResetOnInvalidCursor';
import { nodesOf } from '../../lib/connection';
import {
  type NovelFilters,
  novelQuery,
} from '../../lib/novel-filters';

const PAGE_SIZE = 20;

export const ADMIN_NOVELS_KEY = 'AdminNovelsInfinite';

export function useAdminNovels(
  filters: NovelFilters | undefined,
  orderBy: NovelOrder | undefined,
  enabled: boolean,
) {
  const queryKey = [ADMIN_NOVELS_KEY, filters, orderBy];
  const query = useInfiniteQuery({
    queryKey,
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      useAdminNovelsQuery.fetcher({
        ...novelQuery(filters),
        orderBy,
        first: PAGE_SIZE,
        after: pageParam,
      })(),
    getNextPageParam: ({ novels }) =>
      novels.pageInfo.hasNextPage
        ? novels.pageInfo.endCursor
        : undefined,
  });

  useResetOnInvalidCursor(queryKey, query.error);

  return {
    novels: (query.data?.pages ?? []).flatMap((page) =>
      nodesOf(page.novels),
    ),
    isLoading: query.isLoading,
    isError: query.isError,
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => query.fetchNextPage(),
  };
}

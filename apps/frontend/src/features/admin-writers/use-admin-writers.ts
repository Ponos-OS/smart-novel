import { useInfiniteQuery } from '@tanstack/react-query';

import {
  useAdminWritersQuery,
  WriterStatus,
} from '../../generated/graphql';
import { useResetOnInvalidCursor } from '../../hooks/useResetOnInvalidCursor';
import { nodesOf } from '../../lib/connection';

const PAGE_SIZE = 20;

export const ADMIN_WRITERS_KEY = 'AdminWritersInfinite';

export function useAdminWriters(
  status: WriterStatus,
  enabled: boolean,
) {
  const queryKey = [ADMIN_WRITERS_KEY, status];
  const query = useInfiniteQuery({
    queryKey,
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      useAdminWritersQuery.fetcher({
        status,
        first: PAGE_SIZE,
        after: pageParam,
      })(),
    getNextPageParam: ({ writers }) =>
      writers.pageInfo.hasNextPage
        ? writers.pageInfo.endCursor
        : undefined,
  });

  useResetOnInvalidCursor(queryKey, query.error);

  return {
    requests: (query.data?.pages ?? []).flatMap((page) =>
      nodesOf(page.writers),
    ),
    isLoading: query.isLoading,
    isError: query.isError,
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => query.fetchNextPage(),
  };
}

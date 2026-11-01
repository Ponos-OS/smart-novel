import { useInfiniteQuery } from '@tanstack/react-query';

import {
  useAdminWritersQuery,
  WriterStatus,
} from '../../generated/graphql';
import { useResetOnInvalidCursor } from '../../hooks/useResetOnInvalidCursor';

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
    getNextPageParam: ({ writersConnection }) =>
      writersConnection.pageInfo.hasNextPage
        ? writersConnection.pageInfo.endCursor
        : undefined,
  });

  useResetOnInvalidCursor(queryKey, query.error);

  return {
    requests: (query.data?.pages ?? []).flatMap((page) =>
      page.writersConnection.edges.map(({ node }) => node),
    ),
    isLoading: query.isLoading,
    isError: query.isError,
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => query.fetchNextPage(),
  };
}

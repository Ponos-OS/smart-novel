import { useInfiniteQuery } from '@tanstack/react-query';

import {
  useAdminWriterRequestsQuery,
  WriterRequestStatus,
} from '../../generated/graphql';
import { useResetOnInvalidCursor } from '../../hooks/useResetOnInvalidCursor';

const PAGE_SIZE = 20;

export const ADMIN_WRITER_REQUESTS_KEY =
  'AdminWriterRequestsInfinite';

export function useAdminWriterRequests(
  status: WriterRequestStatus,
  enabled: boolean,
) {
  const queryKey = [ADMIN_WRITER_REQUESTS_KEY, status];
  const query = useInfiniteQuery({
    queryKey,
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      useAdminWriterRequestsQuery.fetcher({
        status,
        first: PAGE_SIZE,
        after: pageParam,
      })(),
    getNextPageParam: ({ writerRequestsConnection }) =>
      writerRequestsConnection.pageInfo.hasNextPage
        ? writerRequestsConnection.pageInfo.endCursor
        : undefined,
  });

  useResetOnInvalidCursor(queryKey, query.error);

  return {
    requests: (query.data?.pages ?? []).flatMap((page) =>
      page.writerRequestsConnection.edges.map(({ node }) => node),
    ),
    isLoading: query.isLoading,
    isError: query.isError,
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => query.fetchNextPage(),
  };
}

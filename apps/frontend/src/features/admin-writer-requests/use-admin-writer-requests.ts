import { useInfiniteQuery } from '@tanstack/react-query';

import {
  useAdminWriterRequestsQuery,
  WriterRequestStatus,
} from '../../generated/graphql';

const PAGE_SIZE = 20;

export const ADMIN_WRITER_REQUESTS_KEY =
  'AdminWriterRequestsInfinite';

export function useAdminWriterRequests(
  status: WriterRequestStatus,
  enabled: boolean,
) {
  const query = useInfiniteQuery({
    queryKey: [ADMIN_WRITER_REQUESTS_KEY, status],
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

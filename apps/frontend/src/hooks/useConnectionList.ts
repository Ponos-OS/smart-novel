import {
  keepPreviousData,
  type QueryKey,
  useInfiniteQuery,
} from '@tanstack/react-query';

import { useResetOnInvalidCursor } from './useResetOnInvalidCursor';

interface Connection<TNode> {
  edges: { node: TNode }[];
  pageInfo: { hasNextPage: boolean; endCursor?: string | null };
}

interface UseConnectionListOptions<TNode> {
  queryKey: QueryKey;
  fetchPage: (
    after: string | undefined,
  ) => Promise<Connection<TNode>>;
  enabled?: boolean;
  staleTime?: number;
  keepPrevious?: boolean;
}

/**
 * @description
 * A cursor-paginated GraphQL connection as one flat list, a page at a time; restarts from the first page when the backend refuses a cursor.
 */
export function useConnectionList<TNode>({
  queryKey,
  fetchPage,
  enabled,
  staleTime,
  keepPrevious,
}: UseConnectionListOptions<TNode>) {
  const query = useInfiniteQuery({
    queryKey,
    enabled,
    staleTime,
    placeholderData: keepPrevious ? keepPreviousData : undefined,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    getNextPageParam: ({ pageInfo }) =>
      pageInfo.hasNextPage
        ? (pageInfo.endCursor ?? undefined)
        : undefined,
  });

  useResetOnInvalidCursor(queryKey, query.error);

  return {
    nodes: (query.data?.pages ?? []).flatMap((page) =>
      page.edges.map(({ node }) => node),
    ),
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => query.fetchNextPage(),
  };
}

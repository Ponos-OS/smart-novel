import { useInfiniteQuery } from '@tanstack/react-query';

import { useSearchWritersQuery } from '../../generated/graphql';
import { useResetOnInvalidCursor } from '../../hooks/useResetOnInvalidCursor';
import { type PickedWriter } from './novel-filters';

const SUGGESTIONS_PAGE_SIZE = 10;

export function useWriterSuggestions(
  search: string,
  enabled: boolean,
) {
  const queryKey = ['SearchWritersInfinite', search];
  const query = useInfiniteQuery({
    queryKey,
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      useSearchWritersQuery.fetcher({
        search: search || null,
        first: SUGGESTIONS_PAGE_SIZE,
        after: pageParam,
      })(),
    getNextPageParam: ({ writersConnection }) =>
      writersConnection.pageInfo.hasNextPage
        ? writersConnection.pageInfo.endCursor
        : undefined,
  });

  useResetOnInvalidCursor(queryKey, query.error);

  return {
    writers: (query.data?.pages ?? []).flatMap((page) =>
      page.writersConnection.edges.map(
        ({ node }): PickedWriter => node,
      ),
    ),
    isLoading: query.isLoading,
    isError: query.isError,
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => query.fetchNextPage(),
  };
}

import { useInfiniteQuery } from '@tanstack/react-query';

import { useSearchTagsQuery } from '../../generated/graphql';
import { useResetOnInvalidCursor } from '../../hooks/useResetOnInvalidCursor';
import { nodesOf } from '../../lib/connection';

const SUGGESTIONS_PAGE_SIZE = 10;

export function useTagSuggestions(search: string, enabled: boolean) {
  const queryKey = ['SearchTagsInfinite', search];
  const query = useInfiniteQuery({
    queryKey,
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      useSearchTagsQuery.fetcher({
        search: search || null,
        first: SUGGESTIONS_PAGE_SIZE,
        after: pageParam,
      })(),
    getNextPageParam: ({ tags }) =>
      tags.pageInfo.hasNextPage ? tags.pageInfo.endCursor : undefined,
  });

  useResetOnInvalidCursor(queryKey, query.error);

  return {
    names: (query.data?.pages ?? []).flatMap((page) =>
      nodesOf(page.tags).map(({ name }) => name),
    ),
    isLoading: query.isLoading,
    isError: query.isError,
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => query.fetchNextPage(),
  };
}

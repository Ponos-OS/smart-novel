import { useInfiniteQuery } from '@tanstack/react-query';

import { useSearchTagsQuery } from '../../generated/graphql';
import { useResetOnInvalidCursor } from '../../hooks/useResetOnInvalidCursor';

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
    getNextPageParam: ({ tagsConnection }) =>
      tagsConnection.pageInfo.hasNextPage
        ? tagsConnection.pageInfo.endCursor
        : undefined,
  });

  useResetOnInvalidCursor(queryKey, query.error);

  return {
    names: (query.data?.pages ?? []).flatMap((page) =>
      page.tagsConnection.edges.map(({ node }) => node.name),
    ),
    isLoading: query.isLoading,
    isError: query.isError,
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => query.fetchNextPage(),
  };
}

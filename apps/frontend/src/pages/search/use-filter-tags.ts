import { useFilterTagsQuery } from '../../generated/graphql';
import { useConnectionList } from '../../hooks/useConnectionList';

const PAGE_SIZE = 100;
const FRESH_FOR_MS = 30_000;

/**
 * @description
 * The tags whose name contains `search`, a page at a time. The caller debounces what the user types; the query is cached per text, so typing back to something already searched costs no request, and the list stays on screen while the next text loads.
 */
export function useFilterTags(search: string) {
  const { nodes, ...list } = useConnectionList({
    queryKey: ['FilterTagsInfinite', search],
    staleTime: FRESH_FOR_MS,
    keepPrevious: true,
    fetchPage: async (after) =>
      (
        await useFilterTagsQuery.fetcher({
          search: search || null,
          first: PAGE_SIZE,
          after,
        })()
      ).tagsConnection,
  });

  return { tags: nodes, ...list };
}

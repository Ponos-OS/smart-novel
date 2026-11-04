import {
  TagStatus,
  useAdminTagsQuery,
} from '../../generated/graphql';
import { useConnectionList } from '../../hooks/useConnectionList';

const PAGE_SIZE = 20;

export const ADMIN_TAGS_KEY = 'AdminTagsInfinite';

export function useAdminTags(
  search: string,
  statuses: TagStatus[],
  enabled: boolean,
) {
  const { nodes, ...list } = useConnectionList({
    queryKey: [ADMIN_TAGS_KEY, search, statuses],
    enabled,
    fetchPage: async (after) =>
      (
        await useAdminTagsQuery.fetcher({
          search: search || null,
          statuses,
          first: PAGE_SIZE,
          after,
        })()
      ).tagsConnection,
  });

  return { tags: nodes, ...list };
}

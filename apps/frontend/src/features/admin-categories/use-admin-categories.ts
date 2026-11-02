import {
  CategoryStatus,
  useAdminCategoriesQuery,
} from '../../generated/graphql';
import { useConnectionList } from '../../hooks/useConnectionList';

const PAGE_SIZE = 20;

export const ADMIN_CATEGORIES_KEY = 'AdminCategoriesInfinite';

export function useAdminCategories(
  search: string,
  statuses: CategoryStatus[],
  enabled: boolean,
) {
  const { nodes, ...list } = useConnectionList({
    queryKey: [ADMIN_CATEGORIES_KEY, search, statuses],
    enabled,
    fetchPage: async (after) =>
      (
        await useAdminCategoriesQuery.fetcher({
          search: search || null,
          statuses,
          first: PAGE_SIZE,
          after,
        })()
      ).categoriesConnection,
  });

  return { categories: nodes, ...list };
}

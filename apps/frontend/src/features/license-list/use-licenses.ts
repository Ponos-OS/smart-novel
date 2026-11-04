import { useLicensesQuery } from '../../generated/graphql';
import { useConnectionList } from '../../hooks/useConnectionList';

const PAGE_SIZE = 20;

export const LICENSES_KEY = 'LicensesInfinite';

export function useLicenses(search: string) {
  const { nodes, ...list } = useConnectionList({
    queryKey: [LICENSES_KEY, search],
    fetchPage: async (after) =>
      (
        await useLicensesQuery.fetcher({
          search: search || null,
          first: PAGE_SIZE,
          after,
        })()
      ).licensesConnection,
  });

  return { licenses: nodes, ...list };
}

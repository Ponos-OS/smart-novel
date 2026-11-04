import {
  type LicenseScope,
  useAdminLicensesQuery,
} from '../../generated/graphql';
import { useConnectionList } from '../../hooks/useConnectionList';

const PAGE_SIZE = 20;

export const ADMIN_LICENSES_KEY = 'AdminLicensesInfinite';

export function useAdminLicenses(
  search: string,
  scope: LicenseScope | null,
  enabled: boolean,
) {
  const { nodes, ...list } = useConnectionList({
    queryKey: [ADMIN_LICENSES_KEY, search, scope],
    enabled,
    fetchPage: async (after) =>
      (
        await useAdminLicensesQuery.fetcher({
          search: search || null,
          scope,
          first: PAGE_SIZE,
          after,
        })()
      ).licensesConnection,
  });

  return { licenses: nodes, ...list };
}

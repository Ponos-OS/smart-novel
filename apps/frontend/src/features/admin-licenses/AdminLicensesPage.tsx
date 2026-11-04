import { Role } from '@smart-novel/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { StatusToggleGroup } from '../../components/StatusToggleGroup';
import {
  LicenseScope,
  useDefaultLicenseQuery,
  useSetDefaultLicenseMutation,
} from '../../generated/graphql';
import { useAuth } from '../../hooks/useAuth';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { showSuccess } from '../../utils/notification';
import { CreateLicenseDialog } from './CreateLicenseDialog';
import {
  type AdminLicense,
  LicenseRow,
  SCOPE_LABELS,
} from './LicenseRow';
import {
  ADMIN_LICENSES_KEY,
  useAdminLicenses,
} from './use-admin-licenses';

type ScopeFilter = 'all' | LicenseScope;

const SCOPE_FILTERS: { value: ScopeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  ...Object.values(LicenseScope).map((scope) => ({
    value: scope,
    label: SCOPE_LABELS[scope],
  })),
];

const SEARCH_DEBOUNCE_MS = 300;

const COLUMNS = ['Name', 'Scope', 'Source', 'Owner', 'Updated'];

export function AdminLicensesPage() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = !!user?.roles.includes(Role.admin);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [settingDefault, setSettingDefault] =
    useState<AdminLicense | null>(null);
  const setDefaultLicense = useSetDefaultLicenseMutation();
  const debouncedSearch = useDebouncedValue(
    search.trim(),
    SEARCH_DEBOUNCE_MS,
  );
  const licenses = useAdminLicenses(
    debouncedSearch,
    scopeFilter === 'all' ? null : scopeFilter,
    isAdmin,
  );

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: [ADMIN_LICENSES_KEY] });
    queryClient.invalidateQueries({
      queryKey: useDefaultLicenseQuery.getKey({}),
    });
  };

  const closeConfirmation = () => {
    setSettingDefault(null);
    setDefaultLicense.reset();
  };

  const handleConfirmDefault = () => {
    if (!settingDefault) {
      return;
    }

    setDefaultLicense.mutate(
      { input: { licenseId: settingDefault.id } },
      {
        onSuccess: () => {
          showSuccess('The default license was changed.');
          closeConfirmation();
          refresh();
        },
      },
    );
  };

  if (authLoading) {
    return <LoadingSpinner label="Loading licenses..." />;
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center text-red-400">
        <p>You don't have permission to manage licenses.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-white">Licenses</h1>
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
        >
          Create license
        </button>
      </div>
      <p className="mb-6 text-sm text-gray-400">
        Shared licenses are the ones every writer can use. New novels
        get the default one unless their author picks another;
        existing novels keep theirs.
      </p>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          aria-label="Search licenses"
          placeholder="Search licenses"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full max-w-xs rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white"
        />
        <StatusToggleGroup
          value={scopeFilter}
          options={SCOPE_FILTERS}
          onChange={setScopeFilter}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-700 bg-gray-800">
        <table className="w-full text-left">
          <thead className="text-xs text-gray-400">
            <tr>
              {COLUMNS.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="px-4 py-3 font-medium"
                >
                  {column}
                </th>
              ))}
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {licenses.licenses.map((license) => (
              <LicenseRow
                key={license.id}
                license={license}
                onSetDefault={setSettingDefault}
              />
            ))}
          </tbody>
        </table>
        {licenses.isLoading && (
          <p
            role="status"
            className="px-4 py-6 text-center text-gray-400"
          >
            Loading licenses...
          </p>
        )}
        {licenses.isError && (
          <p
            role="alert"
            className="px-4 py-6 text-center text-red-400"
          >
            Failed to fetch the licenses
          </p>
        )}
        {!licenses.isLoading &&
          !licenses.isError &&
          licenses.licenses.length === 0 && (
            <p className="px-4 py-6 text-center text-gray-400">
              No license matches.
            </p>
          )}
      </div>

      {licenses.hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            disabled={licenses.isLoadingMore}
            onClick={() => licenses.loadMore()}
            className="cursor-pointer rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {licenses.isLoadingMore ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}

      {isCreating && (
        <CreateLicenseDialog
          onCreated={() => {
            setIsCreating(false);
            refresh();
          }}
          onClose={() => setIsCreating(false)}
        />
      )}

      {settingDefault && (
        <ConfirmDialog
          title="Change the default license"
          message={`Every new novel without a chosen license will get "${settingDefault.name}". Existing novels keep their license.`}
          confirmLabel="Change default"
          loadingLabel="Changing..."
          isLoading={setDefaultLicense.isPending}
          error={
            setDefaultLicense.error instanceof Error
              ? setDefaultLicense.error.message
              : null
          }
          onConfirm={handleConfirmDefault}
          onCancel={closeConfirmation}
        />
      )}
    </div>
  );
}

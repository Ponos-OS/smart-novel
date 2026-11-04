import { Role } from '@smart-novel/shared';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import {
  LicenseScope,
  useDefaultLicenseQuery,
} from '../../generated/graphql';
import { useAuth } from '../../hooks/useAuth';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { type LicenseSummary } from '../novel-license/license-notice';
import { LicenseTextDialog } from './LicenseTextDialog';
import { useLicenses } from './use-licenses';

const SCOPE_LABELS: Record<LicenseScope, string> = {
  [LicenseScope.Shared]: 'Shared',
  [LicenseScope.Personal]: 'Yours',
  [LicenseScope.Draft]: 'Your draft',
};

const SEARCH_DEBOUNCE_MS = 300;

export function LicensesTab() {
  const { user } = useAuth();
  const isAdmin = !!user?.roles.includes(Role.admin);
  const [search, setSearch] = useState('');
  const [reading, setReading] = useState<LicenseSummary | null>(null);
  const { data: defaultData } = useDefaultLicenseQuery();
  const defaultLicense = defaultData?.defaultLicense;
  const licenses = useLicenses(
    useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS),
  );

  return (
    <div>
      <p className="mb-4 text-sm text-gray-300">
        New novels get{' '}
        {defaultLicense ? (
          <button
            type="button"
            onClick={() => setReading(defaultLicense)}
            className="cursor-pointer font-medium text-blue-400"
          >
            {defaultLicense.name}
          </button>
        ) : (
          'the default license'
        )}{' '}
        unless their author picks another.
        {isAdmin && (
          <>
            {' '}
            <Link
              to="/admin/licenses"
              className="font-medium text-blue-400"
            >
              Manage licenses
            </Link>
          </>
        )}
      </p>
      <input
        type="search"
        aria-label="Search licenses"
        placeholder="Search licenses"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="mb-4 w-full max-w-xs rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white"
      />
      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="w-full text-left">
          <thead className="text-xs text-gray-400">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Name
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Scope
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Source
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Updated
              </th>
            </tr>
          </thead>
          <tbody>
            {licenses.licenses.map((license) => (
              <tr
                key={license.id}
                className="border-t border-gray-700"
              >
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setReading(license)}
                    className="cursor-pointer text-left font-medium text-blue-400"
                  >
                    {license.name || 'Untitled draft'}
                  </button>
                  {license.isDefault && (
                    <span className="ml-2 rounded-full bg-green-900 px-2 py-0.5 text-xs text-green-200">
                      Default
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-300">
                  {SCOPE_LABELS[license.scope]}
                </td>
                <td className="px-4 py-3 text-sm text-gray-300">
                  {license.canonicalId ?? 'Custom'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-300">
                  {new Date(license.updatedAt).toLocaleDateString(
                    'en-US',
                  )}
                </td>
              </tr>
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
      {reading && (
        <LicenseTextDialog
          license={reading}
          onClose={() => setReading(null)}
        />
      )}
    </div>
  );
}

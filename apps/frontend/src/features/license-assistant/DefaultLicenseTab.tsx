import { Role } from '@smart-novel/shared';
import { Link } from 'react-router-dom';

import { useDefaultLicenseQuery } from '../../generated/graphql';
import { useAuth } from '../../hooks/useAuth';
import {
  getLicenseNotice,
  LICENSE_DISCLAIMER,
} from '../novel-license/license-notice';
import { OfficialLicenseLink } from '../novel-license/OfficialLicenseLink';

export function DefaultLicenseTab() {
  const { user } = useAuth();
  const { data, isLoading } = useDefaultLicenseQuery();
  const license = data?.defaultLicense;

  if (isLoading) {
    return <p>Loading the default license...</p>;
  }

  if (!license) {
    return <p role="alert">Failed to fetch the default license</p>;
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">
        {license.name}
      </h2>
      <p className="mb-2 text-sm text-gray-700 dark:text-gray-300">
        {getLicenseNotice(license)}
      </p>
      <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">
        New novels get this license. Authors may change it for each of
        their novels.
        {user?.roles.includes(Role.admin) && (
          <>
            {' '}
            <Link
              to="/admin/licenses"
              className="font-medium text-blue-600 dark:text-blue-400"
            >
              Change the default license
            </Link>
          </>
        )}
      </p>
      <p className="mb-4">
        <OfficialLicenseLink officialUrl={license.officialUrl} />
      </p>
      <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">
        {license.text}
      </pre>
      <p className="mt-4 text-xs text-gray-600 dark:text-gray-400">
        {LICENSE_DISCLAIMER}
      </p>
    </div>
  );
}

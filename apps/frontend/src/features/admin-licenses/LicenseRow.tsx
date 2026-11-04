import {
  type AdminLicensesQuery,
  LicenseScope,
  LicenseSourceType,
} from '../../generated/graphql';

export type AdminLicense =
  AdminLicensesQuery['licensesConnection']['edges'][number]['node'];

interface LicenseRowProps {
  license: AdminLicense;
  onSetDefault: (license: AdminLicense) => void;
}

const SCOPE_CLASSES: Record<LicenseScope, string> = {
  [LicenseScope.Shared]: 'bg-blue-900 text-blue-200',
  [LicenseScope.Personal]: 'bg-gray-700 text-gray-200',
  [LicenseScope.Draft]: 'bg-yellow-900 text-yellow-200',
};

export const SCOPE_LABELS: Record<LicenseScope, string> = {
  [LicenseScope.Shared]: 'Shared',
  [LicenseScope.Personal]: 'Personal',
  [LicenseScope.Draft]: 'Draft',
};

const SOURCE_LABELS: Record<LicenseSourceType, string> = {
  [LicenseSourceType.Canonical]: 'Canonical',
  [LicenseSourceType.Forked]: 'Modified',
  [LicenseSourceType.Custom]: 'Custom',
};

const SYSTEM_OWNER = 'system';

export function LicenseRow({
  license,
  onSetDefault,
}: LicenseRowProps) {
  const canBeDefault =
    license.scope === LicenseScope.Shared && !license.isDefault;

  return (
    <tr className="border-t border-gray-700 align-top">
      <td className="px-4 py-3 text-white">
        {license.name || 'Untitled draft'}
        {license.canonicalId && (
          <span className="block text-xs text-gray-400">
            {license.canonicalId}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${SCOPE_CLASSES[license.scope]}`}
        >
          {SCOPE_LABELS[license.scope]}
        </span>
        {license.isDefault && (
          <span className="ml-2 rounded-full bg-green-900 px-2 py-0.5 text-xs text-green-200">
            Default
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-300">
        {SOURCE_LABELS[license.sourceType]}
      </td>
      <td className="px-4 py-3 text-sm text-gray-300">
        {license.ownerId === SYSTEM_OWNER
          ? 'Platform'
          : license.ownerId}
      </td>
      <td className="px-4 py-3 text-sm text-gray-300">
        {new Date(license.updatedAt).toLocaleDateString('en-US')}
      </td>
      <td className="px-4 py-3 text-right">
        {canBeDefault && (
          <button
            type="button"
            onClick={() => onSetDefault(license)}
            className="cursor-pointer text-sm font-medium text-blue-400"
          >
            Set as default
          </button>
        )}
      </td>
    </tr>
  );
}

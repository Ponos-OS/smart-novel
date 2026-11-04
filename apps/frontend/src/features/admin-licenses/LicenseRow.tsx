import { Switch } from 'radix-ui';

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
  const isShared = license.scope === LicenseScope.Shared;

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
        {isShared && (
          <Switch.Root
            checked={license.isDefault}
            // The default cannot be unset: turning another license on is what moves it.
            disabled={license.isDefault}
            onCheckedChange={() => onSetDefault(license)}
            aria-label={
              license.isDefault
                ? `${license.name} is the default license`
                : `Make ${license.name} the default license`
            }
            className="relative h-6 w-11 cursor-pointer rounded-full bg-gray-600 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed data-[state=checked]:bg-blue-600 data-[disabled]:opacity-70"
          >
            <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white transition-transform data-[state=checked]:translate-x-[22px]" />
          </Switch.Root>
        )}
      </td>
    </tr>
  );
}

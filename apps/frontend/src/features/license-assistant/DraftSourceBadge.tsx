import {
  type LicenseDraftInput,
  LicenseSourceType,
  useCanonicalLicensesQuery,
} from '../../generated/graphql';
import { OfficialLicenseLink } from '../novel-license/OfficialLicenseLink';

interface DraftSourceBadgeProps {
  source: LicenseDraftInput['source'];
}

function describe(type: LicenseSourceType, baseName?: string | null) {
  if (type === LicenseSourceType.Canonical) {
    return `Canonical license: ${baseName}`;
  }
  if (type === LicenseSourceType.Forked) {
    return `Modified from ${baseName} \u2014 not the same as the canonical license`;
  }

  return 'Custom license \u2014 review with a lawyer.';
}

/**
 * @description Says where the draft's text comes from, in words, so it does not rely on a colour.
 */
export function DraftSourceBadge({ source }: DraftSourceBadgeProps) {
  const { data } = useCanonicalLicensesQuery(
    {},
    { enabled: !!source.canonicalId },
  );
  const base = data?.canonicalLicenses.find(
    (canonical) => canonical.id === source.canonicalId,
  );
  const baseName = base?.shortName ?? source.canonicalId;

  return (
    <div className="mb-3 rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100">
      <p className="font-semibold">
        {describe(source.type, baseName)}
      </p>
      {source.type !== LicenseSourceType.Custom && (
        <p className="mt-1">
          <OfficialLicenseLink officialUrl={base?.officialUrl} />
        </p>
      )}
    </div>
  );
}

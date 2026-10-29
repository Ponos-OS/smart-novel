import {
  type LicenseDraftInput,
  LicenseSourceType,
  useCanonicalLicensesQuery,
} from '../../generated/graphql';
import { OfficialLicenseLink } from '../novel-license/OfficialLicenseLink';
import { useMessages } from './i18n';

interface DraftSourceBadgeProps {
  source: LicenseDraftInput['source'];
}

/**
 * @description Says where the draft's text comes from, in words, so it does not rely on a colour. The license is named by the short name of the registry (or its id until that loads), which is the same in every language.
 */
export function DraftSourceBadge({ source }: DraftSourceBadgeProps) {
  const t = useMessages();
  const { data } = useCanonicalLicensesQuery(
    {},
    { enabled: !!source.canonicalId },
  );
  const base = data?.canonicalLicenses.find(
    (canonical) => canonical.id === source.canonicalId,
  );
  const name = base?.shortName ?? source.canonicalId ?? '';
  let sentence = t('source.custom');

  if (source.type === LicenseSourceType.Canonical) {
    sentence = t('source.canonical', { name });
  } else if (source.type === LicenseSourceType.Forked) {
    sentence = t('source.forked', { name });
  }

  return (
    <div className="mb-3 rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100">
      <p className="font-semibold">{sentence}</p>
      {source.type !== LicenseSourceType.Custom && (
        <p className="mt-1">
          <OfficialLicenseLink
            officialUrl={base?.officialUrl}
            label={t('license.officialLink')}
          />
        </p>
      )}
    </div>
  );
}

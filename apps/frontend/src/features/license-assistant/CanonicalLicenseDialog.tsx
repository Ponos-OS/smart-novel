import { Dialog } from '../../components/Dialog';
import { useCanonicalLicenseQuery } from '../../generated/graphql';
import { OfficialLicenseLink } from '../novel-license/OfficialLicenseLink';
import { DraftBody } from './DraftBody';
import { useMessages } from './i18n';
import { toLicenseAssistantError } from './license-assistant-error';

interface CanonicalLicenseDialogProps {
  licenseId: string;
  onClose: () => void;
}

export function CanonicalLicenseDialog({
  licenseId,
  onClose,
}: CanonicalLicenseDialogProps) {
  const t = useMessages();
  const { data, error } = useCanonicalLicenseQuery({ id: licenseId });
  const license = data?.canonicalLicense;

  return (
    <Dialog
      title={license?.name ?? licenseId}
      onClose={onClose}
      closeLabel={t('dialog.close')}
    >
      {!!error && (
        <p role="alert" className="text-sm text-red-400">
          {t(toLicenseAssistantError(error).messageKey)}
        </p>
      )}
      {!license && !error && (
        <p role="status" className="text-sm text-gray-300">
          {t('license.loading')}
        </p>
      )}
      {license && (
        <div className="space-y-4 text-sm text-gray-200">
          <p>
            <strong>
              {t('license.summary', {
                shortName: license.shortName,
                version: license.version,
                category: license.category,
              })}
            </strong>
          </p>
          <p>{license.summary}</p>
          <TermList
            title={t('license.permissions')}
            items={license.permissions}
          />
          <TermList
            title={t('license.limitations')}
            items={license.limitations}
          />
          <TermList
            title={t('license.conditions')}
            items={license.conditions}
          />
          <p>
            <OfficialLicenseLink
              officialUrl={license.officialUrl}
              label={t('license.officialLink')}
            />
          </p>
          <section aria-label={t('license.fullText')}>
            <DraftBody text={license.body} />
          </section>
        </div>
      )}
    </Dialog>
  );
}

function TermList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section aria-label={title}>
      <h3 className="font-bold text-white">{title}</h3>
      <ul className="list-disc pl-5">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

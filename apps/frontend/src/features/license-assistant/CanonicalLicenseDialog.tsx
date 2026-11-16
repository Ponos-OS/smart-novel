import { Dialog } from '../../components/Dialog';
import { useCanonicalLicenseQuery } from '../../generated/graphql';
import { nodesOf } from '../../lib/connection';
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
  const { data, error } = useCanonicalLicenseQuery({
    canonicalID: licenseId,
  });
  const license = nodesOf(data?.licenses ?? {})[0];

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
                name: license.name,
                version: license.version ?? '',
              })}
            </strong>
          </p>
          <p>
            <OfficialLicenseLink
              officialUrl={license.officialURL}
              label={t('license.officialLink')}
            />
          </p>
          <section aria-label={t('license.fullText')}>
            <DraftBody text={license.text} />
          </section>
        </div>
      )}
    </Dialog>
  );
}

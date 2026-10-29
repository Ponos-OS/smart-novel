import { Dialog } from '../../components/Dialog';
import { useCanonicalLicenseQuery } from '../../generated/graphql';
import { OfficialLicenseLink } from '../novel-license/OfficialLicenseLink';
import { DraftBody } from './DraftBody';
import { toLicenseAssistantError } from './license-assistant-error';

interface CanonicalLicenseDialogProps {
  licenseId: string;
  onClose: () => void;
}

export function CanonicalLicenseDialog({
  licenseId,
  onClose,
}: CanonicalLicenseDialogProps) {
  const { data, error } = useCanonicalLicenseQuery({ id: licenseId });
  const license = data?.canonicalLicense;

  return (
    <Dialog title={license?.name ?? licenseId} onClose={onClose}>
      {!!error && (
        <p
          role="alert"
          className="text-sm text-red-600 dark:text-red-400"
        >
          {toLicenseAssistantError(error).message}
        </p>
      )}
      {!license && !error && (
        <p
          role="status"
          className="text-sm text-gray-700 dark:text-gray-300"
        >
          Loading the license...
        </p>
      )}
      {license && (
        <div className="space-y-4 text-sm text-gray-800 dark:text-gray-200">
          <p>
            <strong>{license.shortName}</strong>, version{' '}
            {license.version}, {license.category}
          </p>
          <p>{license.summary}</p>
          <TermList title="Permissions" items={license.permissions} />
          <TermList title="Limitations" items={license.limitations} />
          <TermList title="Conditions" items={license.conditions} />
          <p>
            <OfficialLicenseLink officialUrl={license.officialUrl} />
          </p>
          <section aria-label="Full text">
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
      <h3 className="font-bold text-gray-900 dark:text-white">
        {title}
      </h3>
      <ul className="list-disc pl-5">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

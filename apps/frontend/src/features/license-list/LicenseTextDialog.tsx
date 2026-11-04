import { Dialog } from '../../components/Dialog';
import {
  getLicenseNotice,
  LICENSE_DISCLAIMER,
  type LicenseSummary,
} from '../novel-license/license-notice';
import { OfficialLicenseLink } from '../novel-license/OfficialLicenseLink';

interface LicenseTextDialogProps {
  license: LicenseSummary;
  onClose: () => void;
}

export function LicenseTextDialog({
  license,
  onClose,
}: LicenseTextDialogProps) {
  return (
    <Dialog
      title={license.name || 'Untitled draft'}
      onClose={onClose}
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-300">
          {getLicenseNotice(license)}
        </p>
        <OfficialLicenseLink officialUrl={license.officialUrl} />
        <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap text-sm text-gray-200">
          {license.text || 'This draft has no text yet.'}
        </pre>
        <p className="text-xs text-gray-400">{LICENSE_DISCLAIMER}</p>
      </div>
    </Dialog>
  );
}

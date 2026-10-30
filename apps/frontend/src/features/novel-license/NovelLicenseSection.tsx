import {
  getLicenseNotice,
  LICENSE_DISCLAIMER,
  type LicenseSummary,
} from './license-notice';
import { OfficialLicenseLink } from './OfficialLicenseLink';

interface NovelLicenseSectionProps {
  license: LicenseSummary;
}

export function NovelLicenseSection({
  license,
}: NovelLicenseSectionProps) {
  return (
    <section
      aria-labelledby="novel-license-heading"
      className="mt-6 rounded-xl border border-gray-700/70 bg-gray-800 p-6"
    >
      <h2
        id="novel-license-heading"
        className="text-xl font-bold text-white"
      >
        License: {license.name}
      </h2>
      <p className="mt-1 text-sm text-gray-300">
        {getLicenseNotice(license)}
      </p>
      <p className="mt-1">
        <OfficialLicenseLink officialUrl={license.officialUrl} />
      </p>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium text-blue-400">
          Read the full license text
        </summary>
        <pre className="mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap text-sm text-gray-200">
          {license.text}
        </pre>
      </details>
      <p className="mt-3 text-xs text-gray-400">
        {LICENSE_DISCLAIMER}
      </p>
    </section>
  );
}

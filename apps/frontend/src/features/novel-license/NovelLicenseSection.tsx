import {
  getLicenseNotice,
  LICENSE_DISCLAIMER,
  type LicenseSummary,
} from './license-notice';

interface NovelLicenseSectionProps {
  license: LicenseSummary;
}

export function NovelLicenseSection({
  license,
}: NovelLicenseSectionProps) {
  return (
    <section
      aria-labelledby="novel-license-heading"
      className="mt-6 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
    >
      <h2
        id="novel-license-heading"
        className="text-xl font-bold text-gray-900 dark:text-white"
      >
        License: {license.name}
      </h2>
      <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
        {getLicenseNotice(license)}
      </p>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium text-blue-600 dark:text-blue-400">
          Read the full license text
        </summary>
        <pre className="mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">
          {license.text}
        </pre>
      </details>
      <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
        {LICENSE_DISCLAIMER}
      </p>
    </section>
  );
}

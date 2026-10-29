interface OfficialLicenseLinkProps {
  officialUrl?: string | null;
  /** @description The text of the link, for a language other than English. */
  label?: string;
}

export function OfficialLicenseLink({
  officialUrl,
  label = 'Read the official license text (opens in a new tab)',
}: OfficialLicenseLinkProps) {
  if (!officialUrl) {
    return null;
  }

  return (
    <a
      href={officialUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm font-medium text-blue-600 underline dark:text-blue-400"
    >
      {label}
    </a>
  );
}

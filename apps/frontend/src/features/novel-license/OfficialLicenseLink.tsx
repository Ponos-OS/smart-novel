interface OfficialLicenseLinkProps {
  officialUrl?: string | null;
}

export function OfficialLicenseLink({
  officialUrl,
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
      Read the official license text (opens in a new tab)
    </a>
  );
}

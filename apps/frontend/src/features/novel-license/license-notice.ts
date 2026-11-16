import { LicenseSourceType } from '../../generated/graphql';

export interface LicenseSummary {
  id: string;
  name: string;
  sourceType: LicenseSourceType;
  canonicalID?: string | null;
  officialURL?: string | null;
  text: string;
}

export const LICENSE_DISCLAIMER =
  'Licence information explains permissions; it does not determine who owns the copyright, and it is not legal advice.';

export function getLicenseNotice({
  name,
  sourceType,
  canonicalID,
}: LicenseSummary): string {
  if (sourceType === LicenseSourceType.Canonical) {
    return `Canonical license ${canonicalID ?? name}`;
  }

  if (sourceType === LicenseSourceType.Forked) {
    return `Modified from ${canonicalID} - not the same as the canonical license`;
  }

  return 'Custom license - review with a lawyer.';
}

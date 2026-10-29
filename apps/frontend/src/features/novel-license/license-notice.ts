import { LicenseSourceType } from '../../generated/graphql';

export interface LicenseSummary {
  id: string;
  name: string;
  sourceType: LicenseSourceType;
  canonicalId?: string | null;
  text: string;
}

export const LICENSE_DISCLAIMER =
  'Licence information explains permissions; it does not determine who owns the copyright, and it is not legal advice.';

export function getLicenseNotice({
  name,
  sourceType,
  canonicalId,
}: LicenseSummary): string {
  if (sourceType === LicenseSourceType.Canonical) {
    return `Canonical license ${canonicalId ?? name}`;
  }

  if (sourceType === LicenseSourceType.Forked) {
    return `Modified from ${canonicalId} - not the same as the canonical license`;
  }

  return 'Custom license - review with a lawyer.';
}

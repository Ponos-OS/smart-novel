/**
 * @description
 * One application to become a writer, an entry of the append-only `writers.applications` column. The review fields stay null until an admin decides, and that is the only time an entry changes. Dates are ISO strings in UTC.
 */
export interface StoredWriterApplication {
  note: string;
  appliedAt: string;
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

const STRING_FIELDS = ['note', 'appliedAt'] as const;
const NULLABLE_STRING_FIELDS = [
  'rejectionReason',
  'reviewedBy',
  'reviewedAt',
] as const;

function isIsoDate(value: string): boolean {
  return (
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

function isApplication(
  value: unknown,
): value is StoredWriterApplication {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const entry = value as Record<string, unknown>;
  const stringsAreValid = STRING_FIELDS.every(
    (field) => typeof entry[field] === 'string',
  );
  const nullablesAreValid = NULLABLE_STRING_FIELDS.every(
    (field) =>
      entry[field] === null || typeof entry[field] === 'string',
  );

  return (
    stringsAreValid &&
    nullablesAreValid &&
    isIsoDate(entry.appliedAt as string) &&
    (entry.reviewedAt === null ||
      isIsoDate(entry.reviewedAt as string))
  );
}

/**
 * @description The column is JSON, so it is checked every time it is read: a value that is not a list of applications fails loudly instead of being dropped.
 *
 * @throws When the value is not an array of {@link StoredWriterApplication}.
 */
export function parseApplications(
  value: unknown,
): StoredWriterApplication[] {
  if (!Array.isArray(value) || !value.every(isApplication)) {
    throw new Error('The applications of a writer are malformed');
  }

  return value;
}

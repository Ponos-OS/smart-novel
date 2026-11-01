import { CustomLoggerService } from 'nestjs-backend-common';

/**
 * @description
 * Stable start of the log line for a writer record that is missing where one must exist. A novel always references a `Writer` row (a foreign key) and every writer who creates one has a row, so seeing this means the account was provisioned outside the normal flow; it is never worked around. No alert watches it: the error log and the 500 are enough.
 */
export const WRITER_INTEGRITY_ERROR = 'Writer integrity error';

/**
 * @description Logs the fault (ids only, never a name or an email) and returns the error to throw, which GraphQL answers as a 500.
 */
export function writerIntegrityError(
  logger: CustomLoggerService,
  detail: string,
): Error {
  const message = `${WRITER_INTEGRITY_ERROR}: ${detail}`;

  logger.error(message);

  return new Error(message);
}

import { createHash } from 'node:crypto';

const AUDIENCE_LENGTH = 22;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }

  return value;
}

/**
 * @description Identity of a paginated query, so a cursor can only be used for the query it was issued for.
 *
 * @param connection Names the connection (and with it any sort that is fixed in code)
 * @param query Everything else the page depends on: filters, scope (parent id, viewer) and, when the client can choose it, the sort. A client-chosen sort MUST be part of the query: the cursor is only a row id, so reusing it under another sort starts the page at that row in a different sequence. A sort fixed in code is not part of the query, so changing it in code does not invalidate cursors issued before.
 */
export function buildAudience(
  connection: string,
  query: Record<string, unknown> = {},
): string {
  const canonical = JSON.stringify(
    canonicalize({ connection, query }),
  );

  return createHash('sha256')
    .update(canonical)
    .digest('base64url')
    .slice(0, AUDIENCE_LENGTH);
}

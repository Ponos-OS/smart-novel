import { type QueryKey, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { isInvalidCursorError } from '../lib/graphql-fetcher';

/**
 * @description
 * An infinite list keeps the cursors it was given. When the backend refuses one (the signing key changed, or it belongs to another query) the list starts over from its first page instead of staying broken.
 */
export function useResetOnInvalidCursor(
  queryKey: QueryKey,
  error: unknown,
) {
  const queryClient = useQueryClient();
  const hashedKey = JSON.stringify(queryKey);

  useEffect(() => {
    if (!isInvalidCursorError(error)) {
      return;
    }

    void queryClient.resetQueries({
      queryKey: JSON.parse(hashedKey),
      exact: true,
    });
  }, [error, hashedKey, queryClient]);
}

import type { QueryClient } from '@tanstack/react-query';

import { useMyPlatformTermsStatusQuery } from '../../generated/graphql';
import { isPlatformTermsNotAcceptedError } from '../../lib/graphql-fetcher';

/**
 * @description Refetching the status re-opens the terms modal, e.g. after a version bump mid-session.
 */
export function reopenOnTermsError(
  queryClient: QueryClient,
  error: unknown,
) {
  if (!isPlatformTermsNotAcceptedError(error)) {
    return;
  }

  void queryClient.invalidateQueries({
    queryKey: useMyPlatformTermsStatusQuery.getKey({}),
  });
}

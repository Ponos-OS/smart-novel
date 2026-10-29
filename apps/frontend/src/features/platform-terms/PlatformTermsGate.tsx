import { isWriterOrHigher } from '@smart-novel/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';

import {
  useAcceptPlatformTermsMutation,
  useMyPlatformTermsStatusQuery,
  usePlatformTermsQuery,
} from '../../generated/graphql';
import { useAuth } from '../../hooks/useAuth';
import { PlatformTermsModal } from './PlatformTermsModal';

const LICENSES_PATH = '/licenses';

export function PlatformTermsGate() {
  const { user, isAuthenticated, logout } = useAuth();
  const queryClient = useQueryClient();
  const { pathname } = useLocation();
  const isWriter =
    isAuthenticated && isWriterOrHigher(user?.roles ?? []);
  const { data: statusData } = useMyPlatformTermsStatusQuery(
    {},
    { enabled: isWriter },
  );
  const status = statusData?.myPlatformTermsStatus;
  const mustAccept =
    isWriter &&
    status?.accepted === false &&
    pathname !== LICENSES_PATH;
  const { data: termsData } = usePlatformTermsQuery(
    {},
    { enabled: mustAccept },
  );
  const accept = useAcceptPlatformTermsMutation({
    onSuccess: (data) =>
      queryClient.setQueryData(
        useMyPlatformTermsStatusQuery.getKey({}),
        { myPlatformTermsStatus: data.acceptPlatformTerms },
      ),
  });
  const terms = termsData?.platformTerms;

  if (!mustAccept || !terms) {
    return null;
  }

  return (
    <PlatformTermsModal
      markdown={terms.markdown}
      isAccepting={accept.isPending}
      error={
        accept.error instanceof Error ? accept.error.message : null
      }
      onAccept={() => accept.mutate({ version: terms.version })}
      onLogout={logout}
    />
  );
}

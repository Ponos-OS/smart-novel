import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';

/**
 * OIDC callback page.
 *
 * `react-oidc-context` automatically processes the authorization code
 * from the URL when the `<AuthProvider>` mounts. This page simply waits
 * for that to complete and then redirects to `/`.
 */
export function CallbackPage() {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [loading, isAuthenticated, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900">
      <div className="text-center">
        <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-r-transparent border-blue-400"></div>
        <h2 className="text-xl font-semibold text-white">
          Completing login...
        </h2>
        <p className="mt-2 text-gray-400">
          Please wait while we verify your authentication.
        </p>
      </div>
    </div>
  );
}

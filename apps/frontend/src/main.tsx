import './instrumentation';

import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { WebStorageStateStore } from 'oidc-client-ts';
import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { AuthProvider, AuthProviderProps } from 'react-oidc-context';

import App from './app/app';
import { reopenOnTermsError } from './features/platform-terms/reopen-on-terms-error';
import './styles.css';

/**
 * @description OIDC configuration.
 *
 * Uses Authorization Code + PKCE (public client — no client_secret needed on the frontend). The Zitadel Login UI handles the actual login form / MFA / etc. Environment variables (set in `.env`):
 */
const oidcConfig: AuthProviderProps = {
  loadUserInfo: true,
  filterProtocolClaims: false,
  client_id: import.meta.env.VITE_OIDC_CLIENT_ID,
  authority: import.meta.env.VITE_OIDC_AUTHORITY,
  redirect_uri:
    import.meta.env.VITE_OIDC_REDIRECT_URI ??
    `${window.location.origin}/auth/callback`,
  post_logout_redirect_uri: window.location.origin,
  scope: import.meta.env.VITE_OIDC_SCOPE,
  response_type: 'code',
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  /**
   * Automatically remove the `?code=...` query params from the URL after the callback is processed.
   */
  onSigninCallback: () => {
    window.history.replaceState(
      {},
      document.title,
      window.location.pathname,
    );
  },
};

const queryClient: QueryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error) => reopenOnTermsError(queryClient, error),
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);

root.render(
  <StrictMode>
    <AuthProvider {...oidcConfig}>
      <QueryClientProvider client={queryClient}>
        <App />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </AuthProvider>
  </StrictMode>,
);

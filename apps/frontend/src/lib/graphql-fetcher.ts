/**
 * @description Thrown by {@link graphqlFetcher} for a GraphQL-level error response
 */
export class GraphqlRequestError extends Error {
  readonly extensions?: Record<string, unknown>;

  constructor(message: string, extensions?: Record<string, unknown>) {
    super(message);
    this.name = 'GraphqlRequestError';
    this.extensions = extensions;
  }
}

export function isConflictError(error: unknown): boolean {
  return (
    error instanceof GraphqlRequestError &&
    error.extensions?.code === 'CONFLICT'
  );
}

/**
 * @description
 * Custom fetcher used by the generated React Query hooks.
 *
 * It reads the OIDC access token from `localStorage` (where `oidc-client-ts` persists it) and sends it as a Bearer token.
 */
function getAccessToken(): string | null {
  /**
   * @description
   * `oidc-client-ts` keys user objects as `oidc.user:<authority>:<client_id>` (see `main.tsx`). Reading that exact key — rather than scanning for any key starting with "oidc.user:" — avoids picking up a stale entry left behind by a previous OIDC client id (e.g. after the local ZITADEL instance was recreated with a new client id).
   */
  const key = `oidc.user:${import.meta.env.VITE_OIDC_AUTHORITY}:${import.meta.env.VITE_OIDC_CLIENT_ID}`;

  try {
    const user = JSON.parse(localStorage.getItem(key) ?? '');
    return user?.access_token ?? null;
  } catch {
    return null;
  }
}

export function graphqlFetcher<TResult, TVariables>(
  query: string | { toString(): string },
  variables?: TVariables,
  _options?: RequestInit['headers'],
): () => Promise<TResult> {
  const VITE_SERVICE_URL = import.meta.env.VITE_SERVICE_URL;

  if (!VITE_SERVICE_URL) {
    throw new Error(
      'VITE_SERVICE_URL environment variable is not defined',
    );
  }

  return async () => {
    const accessToken = getAccessToken();
    const response = await fetch(`${VITE_SERVICE_URL}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : {}),
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });
    const json = await response.json();

    if (json.errors) {
      const [firstError] = json.errors;

      throw new GraphqlRequestError(
        firstError?.message ?? 'Unknown GraphQL error',
        firstError?.extensions,
      );
    }

    return json.data;
  };
}

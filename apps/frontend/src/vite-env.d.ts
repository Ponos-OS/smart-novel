/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OIDC_AUTHORITY: string;
  readonly VITE_OIDC_CLIENT_ID: string;
  readonly VITE_OIDC_REDIRECT_URI: string;
  readonly VITE_OIDC_SCOPE: string;
  readonly VITE_SERVICE_URL: string;
  readonly VITE_OTLP_ENDPOINT: string;
  readonly VITE_SERVICE_NAME?: string;
  readonly VITE_SERVICE_VERSION?: string;
  readonly VITE_EXPLAIN_RATE_CAPACITY: string;
  readonly VITE_EXPLAIN_CONTEXT_CHAR_SIZE: string;
  readonly VITE_EXPLAIN_CACHE_MAX_ENTRIES: string;
  readonly VITE_EXPLAIN_SELECTION_DEBOUNCE_MS: string;
  readonly VITE_LICENSE_DRAFT_AUTOSAVE_SECONDS?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

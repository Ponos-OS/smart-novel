import { StringValue } from 'ms';
import { LogLevel, LogMode } from 'nestjs-backend-common';

export interface AppConfig {
  EXPLAIN_CONTEXT_CHAR_SIZE: number;
  PORT: number;
  CORS_ALLOWED_ORIGINS: string[];
  NODE_ENV: 'development' | 'production' | 'test';
  LOG_MODE: LogMode;
  LOG_LEVEL: LogLevel;
  /**
   * @description Base URL of the smart-novel-beatrice GraphQL endpoint.
   * @example `http://beatrice:3000/graphql`
   */
  BEATRICE_URL: string;
  /**
   * @description Per-request timeout for calls to Beatrice.
   * Use https://www.npmjs.com/package/ms for human-readable duration
   */
  BEATRICE_TIMEOUT: StringValue;
  /**
   * @description Voice name passed to Beatrice's `generateAudio` mutation — must be one Beatrice's configured TTS provider actually exposes via `audioVoices`.
   * @example `default`
   */
  BEATRICE_DEFAULT_VOICE: string;
  /**
   * @description This backend's own base URL, as reachable from inside the Docker network — used to build the `genUploadUrl`/`statusCallbackUrl` callbacks passed to Beatrice's `generateAudio`.
   * @example `http://backend:3000`
   */
  BACKEND_INTERNAL_URL: string;
  /**
   * @description TTL for the backend-side cache of `explainWord` responses, keyed on the (word, context) pair.
   * Use https://www.npmjs.com/package/ms for human-readable duration
   */
  LLM_CACHE_TTL: StringValue;
  REDIS_URL: string;
  REDIS_PASSWORD?: string;
  DATABASE_URL: string;
  OBJECT_STORAGE_REGION: string;
  OBJECT_STORAGE_ENDPOINT?: string;
  OBJECT_STORAGE_ACCESS_KEY?: string;
  OBJECT_STORAGE_SECRET_KEY?: string;
  OBJECT_STORAGE_BUCKET: string;
  OBJECT_STORAGE_PUBLIC_URL: string;
  /**
   * @description OIDC (OpenID Connect) issuer URL
   * @example `http://localhost:8080`
   */
  ZITADEL_ISSUER_URL: string;
  /**
   * @description Internal URL for OIDC (OpenID Connect) discovery/JWKS fetching inside Docker. We should always fall back to `ZITADEL_ISSUER_URL` when not set.
   * @example `http://zitadel:8080`
   */
  ZITADEL_INTERNAL_URL?: string;
  /**
   * @description OIDC client ID for the ZITADEL application (used for ROPC login).
   * Optional — when running in Docker the backend reads the client ID from
   * the shared volume file `/zitadel-pat/client-id` instead.
   * @example `123456789012345678@smart-novel`
   */
  ZITADEL_CLIENT_ID?: string;
  /**
   * @description Absolute path to a file containing the OIDC client ID. Used only in dev env.
   */
  ZITADEL_CLIENT_ID_FILE?: string;
  /**
   * @description Personal Access Token for the ZITADEL service account (machine user).
   * Used to create sessions on behalf of users during login.
   * Optional — when running in Docker the backend reads the PAT from
   * the shared volume file `/zitadel-pat/token` instead.
   */
  ZITADEL_PAT?: string;
  /**
   * @description Absolute path to a file containing the service account PAT.
   * Used in Docker where ZITADEL writes the PAT to a shared volume.
   * @default `/zitadel-pat/token`
   */
  ZITADEL_PAT_FILE?: string;
  /**
   * @description The base domain of your ZITADEL instance
   * @example `https://zitadel.example.com`
   */
  ZITADEL_DOMAIN: string;
  /**
   * @description The client secret for your OIDC application (optional for public clients)
   */
  ZITADEL_CLIENT_SECRET?: string;
  /**
   * @description The full URL where ZITADEL will redirect back after authentication
   * @example `http://localhost:3000/api/auth/callback/zitadel`
   */
  ZITADEL_CALLBACK_URL: string;
  /**
   * @description The URL to redirect after successful login
   * @default `/`
   */
  ZITADEL_POST_LOGIN_URL?: string;
  /**
   * @description The URL to redirect after logout
   * @example `http://localhost:3000`
   */
  ZITADEL_POST_LOGOUT_URL: string;
  /**
   * @description Secret string used to sign the session cookie (min 32 characters)
   */
  SESSION_SECRET: string;
  /**
   * @description Duration of the session in seconds
   * @default 3600
   */
  SESSION_DURATION: number;
  /**
   * @description Service name.
   */
  SERVICE_NAME: string;
  /**
   * @description Toggle OpenTelemetry. When `'false'` the SDK is never started
   * and the app runs with zero OTel overhead. Default in dev: `'true'`.
   */
  OTEL_ENABLED?: 'true' | 'false';
  /**
   * @description OTLP HTTP endpoint of the OpenTelemetry Collector.
   * @example `http://otel-collector:4318`
   */
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;
  /**
   * @description Head sampler name. See OTel spec.
   * @example `parentbased_traceidratio`
   */
  OTEL_TRACES_SAMPLER?: string;
  /**
   * @description Argument for the head sampler — for ratio samplers this is the keep-ratio between 0 and 1.
   * @example `'1.0'` in dev, `'0.05'` in prod.
   */
  OTEL_TRACES_SAMPLER_ARG?: string;
  /**
   * @description Max spans held in the in-memory queue waiting to be exported. Spans beyond this cap are dropped (with a diag warning) — acts as a back-pressure safety valve if the collector is slow/unreachable.
   */
  OTEL_BATCH_MAX_PENDING_SPANS?: string;
  /**
   * @description Max spans sent in a single export request. The processor flushes immediately once the queue reaches this size, regardless of the scheduled delay. Smaller = more frequent, smaller payloads.
   */
  OTEL_BATCH_SPANS_PER_EXPORT?: string;
  /**
   * @description Interval at which the processor wakes up and flushes whatever is currently queued, even if `maxExportBatchSize` hasn't been reached. Trade-off: lower = fresher data in the backend, higher = fewer HTTP round-trips.
   */
  OTEL_BATCH_FLUSH_INTERVAL_MS?: string;
  /**
   * @description Hard deadline for a single export call to the OTLP endpoint. If the collector doesn't respond within this window the export is aborted and the spans in that batch are dropped (not retried).
   */
  OTEL_BATCH_EXPORT_TIMEOUT_MS?: string;
}

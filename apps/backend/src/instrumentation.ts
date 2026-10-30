/**
 * @fileoverview OpenTelemetry bootstrap for the smart-novel backend.
 *
 * This file MUST be imported as the very first line in main.ts so the SDK starts before any other module is loaded (otherwise auto-instrumentations cannot wrap modules that have already been required).
 */

import { Logger } from '@nestjs/common';
import {
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
} from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import {
  CompositePropagator,
  W3CBaggagePropagator,
  W3CTraceContextPropagator,
} from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { PrismaInstrumentation } from '@prisma/instrumentation';

const OTEL_ENABLED = process.env.OTEL_ENABLED === 'true';
let otelSDK: NodeSDK | null = null;

if (!OTEL_ENABLED) {
  Logger.log(
    '[instrumentation] OTEL_ENABLED=false — OpenTelemetry SDK is disabled.',
  );
} else {
  // Surfaces SDK errors.
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);

  /**
   * @description `OTEL_EXPORTER_OTLP_ENDPOINT` is picked up by the SDK automatically, but we also append the /v1/traces path explicitly to be safe.
   */
  const otlpUrl = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    ? `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/$/, '')}/v1/traces`
    : undefined;
  const traceExporter = new OTLPTraceExporter({
    url: otlpUrl,
  });
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.SERVICE_NAME,
    [ATTR_SERVICE_VERSION]:
      process.env.npm_package_version ?? 'unknown',
    'deployment.environment': process.env.NODE_ENV,
  });
  /**
   * @description Batch processor with the volume-control settings.
   */
  const spanProcessor = new BatchSpanProcessor(traceExporter, {
    maxQueueSize: Number.parseInt(
      process.env?.OTEL_BATCH_MAX_PENDING_SPANS ?? '2048',
      10,
    ),
    maxExportBatchSize: Number.parseInt(
      process.env?.OTEL_BATCH_SPANS_PER_EXPORT ?? '512',
      10,
    ),
    scheduledDelayMillis: Number.parseInt(
      process.env?.OTEL_BATCH_FLUSH_INTERVAL_MS ?? '5000',
      10,
    ),
    exportTimeoutMillis: Number.parseInt(
      process.env?.OTEL_BATCH_EXPORT_TIMEOUT_MS ?? '30000',
      10,
    ),
  });
  /**
   * @summary auto-instrumentation for Prisma.
   *
   * ⚠️ WARN: `@prisma/instrumentation` auto-creates a span for **EVERY** single SQL query. This might lead to generating large volumes of OTel data in a short period. We accept the risk for now to get full visibility, and rely on:
   * - head sampling (OTEL_TRACES_SAMPLER_ARG)
   * - collector tail_sampling (infra/terraform/modules/observability/otel-collector-config.yaml.tftpl)
   * - the BatchSpanProcessor limits above
   *
   * Revisit once we see real volume in dev/prod; consider replacing this with a manual TracingService.traceQuery(name, fn, attrs?) helper.
   */
  const prismaInstrumentation = new PrismaInstrumentation();

  otelSDK = new NodeSDK({
    resource,
    spanProcessors: [spanProcessor],
    textMapPropagator: new CompositePropagator({
      propagators: [
        new W3CTraceContextPropagator(),
        new W3CBaggagePropagator(),
      ],
    }),
    instrumentations: [
      prismaInstrumentation,
      ...getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-ioredis': {
          enabled: false,
        },
        '@opentelemetry/instrumentation-redis': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
        // Winston records get `trace_id`/`span_id` injected and, with `@opentelemetry/winston-transport` installed, are shipped as OTLP logs through the collector to Loki (see `OTEL_LOGS_EXPORTER`).
        '@opentelemetry/instrumentation-bunyan': {
          enabled: false, // 👈 This is not used in this codebase, so skip them entirely to avoid spurious warnings if they ever get pulled in transitively.
        },
        '@opentelemetry/instrumentation-pino': { enabled: false },
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (req) => {
            const url = req.url ?? '';

            if (url === '/health') {
              return true; // 👈 Skip the GraphQL health check noise; create resolver spans manually.
            }

            return false;
          },
          /**
           * @description Suppress span creation for noisy outgoing HTTP calls we make from inside the backend.
           *
           * Add new paths here as more internal-only HTTP noise emerges. For dynamic/user-driven noise prefer the collector's tail_sampling filter (`infra/terraform/modules/observability/otel-collector-config.yaml.tftpl`).
           */
          ignoreOutgoingRequestHook: (options) => {
            /**
             * @description `options.path` is the request path including query string; `options.pathname` strips the query (Node ≥ 19). Use `path` for portability and just compare the leading segment.
             */
            const path = ('path' in options && options.path) || '';

            if (typeof path !== 'string') {
              return false;
            }

            if (
              path.startsWith('/oauth/v2/keys') || // 👈 JWKS fetches (`/oauth/v2/keys`): the auth module periodically hits Zitadel (via Traefik) to refresh the JWT signing keys. It's infrastructure plumbing, succeeds 99.99% of the time, and produces single-span orphan traces (no parent context) that don't help debugging real user requests. Filtering at the source saves the serialize/export round-trip too — no span is ever created.
              path.startsWith('/.well-known/openid-configuration') // 👈 OpenID Connect Discovery endpoint (`/.well-known/openid-configuration`): similar to JWKS fetches, this is infrastructure plumbing that doesn't provide actionable signal for user requests.
            ) {
              return true;
            }

            return false;
          },
        },
        /**
         * @description Disable Express instrumentation entirely. We don't own or maintain those middleware layers (`corsMiddleware`, `jsonParser`, `urlencodedParser`, `cookieParser`, `query`, `expressInit`, etc.) and their spans add noise without actionable signal.
         */
        '@opentelemetry/instrumentation-express': {
          enabled: false,
        },
        /**
         * @description Same rationale as `instrumentation-express`: disabled to emit `middleware - <name>` span per router layer (`<anonymous>`, `cookieParser`, `corsMiddleware`, `urlencodedParser`, `jsonParser`, …) with `otel.scope.name = @opentelemetry/instrumentation-router`.
         */
        '@opentelemetry/instrumentation-router': {
          enabled: false,
        },
      }),
    ],
  });

  otelSDK.start();
  Logger.log(
    `[instrumentation] OpenTelemetry SDK started for service "${process.env.SERVICE_NAME}".`,
  );

  /**
   * @description Graceful shutdown — flush pending spans before the process exits.
   */
  const shutdown = (): void => {
    otelSDK
      ?.shutdown()
      .then(
        () =>
          Logger.log('[instrumentation] OTel SDK shut down cleanly.'),
        (err) =>
          Logger.error(
            '[instrumentation] OTel SDK shutdown error:',
            err,
          ),
      )
      .finally(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

export { otelSDK };

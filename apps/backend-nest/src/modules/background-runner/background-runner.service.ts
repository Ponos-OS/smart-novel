import { Injectable } from '@nestjs/common';
import { context } from '@opentelemetry/api';
import { CustomLoggerService } from 'nestjs-backend-common';
import { ClsService, ClsStore } from 'nestjs-cls';

/**
 * @summary Runs fire-and-forget async work with the caller's OpenTelemetry context and CLS store preserved.
 * @description
 * Detached async work (e.g. an `(async () => {...})()` started from inside a request handler) escapes the request's `AsyncLocalStorage` frame the moment the handler returns. After that, two things break:
 *
 * 1. **OTel context propagation**: there is no active span, so downstream auto-instrumentations (Prisma, axios, S3 SDK, ...) produce orphan single-span traces and outgoing HTTP calls no longer get a `traceparent` header injected.
 * 2. **CLS-bound services**: anything reading from `nestjs-cls` falls back to its empty-context defaults, so any request-scoped state stored in CLS is no longer available to the background job.
 *
 * This helper captures both contexts at call time and re-establishes them around the callback. Any error thrown by the callback is caught and logged here so unhandled rejections cannot crash the process.
 */
@Injectable()
export class BackgroundRunnerService {
  constructor(
    private readonly clsService: ClsService,
    private readonly logger: CustomLoggerService,
  ) {}

  run(fn: () => Promise<void>): void {
    const otelContext = context.active();
    const clsStore = this.clsService.isActive()
      ? (this.clsService.get() as ClsStore)
      : undefined;
    const wrapped = () =>
      context.with(otelContext, async () => {
        try {
          await fn();
        } catch (error) {
          this.logger.error(
            `Unhandled error in background task: ${
              error instanceof Error ? error.message : String(error)
            }`,
            {
              context: BackgroundRunnerService.name,
              error,
            },
          );
        }
      });

    if (clsStore) {
      void this.clsService.runWith(clsStore, wrapped);
      return;
    }

    void wrapped();
  }
}

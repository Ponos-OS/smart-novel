import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { trace } from '@opentelemetry/api';
import { Observable, tap } from 'rxjs';

/**
 * @summary Writes the active OpenTelemetry trace ID into the `x-trace-id` response header on every request.
 *
 * **Note**:
 *
 * - This is intentionally separate from the [W3C `traceparent` header](https://www.w3.org/TR/trace-context/#traceparent-header) (which is reserved for service-to-service propagation and is set by the OTel propagators themselves).
 * - There is no active span in the current context (e.g. an instrumentation ignored the request).
 */
@Injectable()
export class TraceIdInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const response = this.resolveResponse(context);

    if (response && typeof response.setHeader === 'function') {
      const span = trace.getActiveSpan();
      const traceId = span?.spanContext().traceId;

      if (traceId && !response.headersSent) {
        response.setHeader('x-trace-id', traceId);
      }
    }

    return next.handle().pipe(
      tap({
        error: () => {
          // Even on error, try to set the header (if not already sent) so the client can correlate the failure with the trace in Jaeger.
          if (
            response &&
            typeof response.setHeader === 'function' &&
            !response.headersSent
          ) {
            const span = trace.getActiveSpan();
            const traceId = span?.spanContext().traceId;

            if (traceId) {
              response.setHeader('x-trace-id', traceId);
            }
          }
        },
      }),
    );
  }

  private resolveResponse(context: ExecutionContext): {
    headersSent?: boolean;
    setHeader?: (k: string, v: string) => void;
  } | null {
    const type = context.getType<GqlContextType>();

    if (type === 'http') {
      return context.switchToHttp().getResponse();
    }

    if (type === 'graphql') {
      const gqlCtx = GqlExecutionContext.create(context).getContext<{
        req?: { res?: unknown };
      }>();
      // Apollo exposes the underlying express response at ctx.req.res.
      return (gqlCtx?.req?.res ?? null) as ReturnType<
        TraceIdInterceptor['resolveResponse']
      >;
    }

    return null; // 👈 WS / RPC contexts have no response object — skip.
  }
}

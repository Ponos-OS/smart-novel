import { CallHandler, ExecutionContext } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TraceIdInterceptor } from './trace-id.interceptor';

vi.mock('@opentelemetry/api', () => ({
  trace: {
    getActiveSpan: vi.fn(),
  },
}));

describe(TraceIdInterceptor.name, () => {
  let uut: TraceIdInterceptor;

  beforeEach(() => {
    uut = new TraceIdInterceptor();

    vi.mocked(trace.getActiveSpan).mockReturnValue({
      spanContext: () => ({
        traceId: 'test-trace-id',
      }),
    } as never);
  });

  it('should add x-trace-id header to the response when we have an HTTP/GraphQL context', async () => {
    // Arrange
    const response = {
      headersSent: false,
      setHeader: vi.fn(),
    };
    const context: ExecutionContext = {
      getType: vi.fn(() => 'http'),
      switchToHttp: vi.fn(() => ({
        getResponse: () => response,
      })),
    } as unknown as ExecutionContext;
    const next: CallHandler = {
      handle: vi.fn(() => of('ok')),
    };

    // Act
    await new Promise<void>((resolve, reject) => {
      uut.intercept(context, next).subscribe({
        next: () => resolve(),
        error: reject,
      });
    });

    // Assert
    expect(response.setHeader).toHaveBeenCalledWith(
      'x-trace-id',
      'test-trace-id',
    );
  });
});

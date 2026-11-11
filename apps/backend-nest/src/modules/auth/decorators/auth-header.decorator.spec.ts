import 'reflect-metadata';
import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { GqlExecutionContext } from '@nestjs/graphql';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthHeader } from './auth-header.decorator';

vi.mock('@nestjs/graphql', () => ({
  GqlExecutionContext: {
    create: vi.fn(),
  },
}));

describe('AuthHeader', () => {
  let mockContext: ExecutionContext;
  let mockGqlContext: any;

  beforeEach(() => {
    vi.resetAllMocks();
    mockContext = {} as ExecutionContext;
    mockGqlContext = {
      getContext: vi.fn(),
    };
    vi.mocked(GqlExecutionContext.create).mockReturnValue(
      mockGqlContext,
    );
  });

  it('should return the authorization header when present', () => {
    mockGqlContext.getContext.mockReturnValue({
      req: { headers: { authorization: 'Bearer token123' } },
    });
    class Test {
      public test(@AuthHeader() _value: any) {}
    }
    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      Test,
      'test',
    );
    const key = Object.keys(metadata)[0];
    const factory = metadata[key].factory;

    const result = factory(undefined, mockContext);

    expect(GqlExecutionContext.create).toHaveBeenCalledWith(
      mockContext,
    );
    expect(mockGqlContext.getContext).toHaveBeenCalled();
    expect(result).toBe('Bearer token123');
  });
});

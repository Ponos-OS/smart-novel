import { context, createContextKey } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { CustomLoggerService } from 'nestjs-backend-common';
import { ClsService } from 'nestjs-cls';

import { BackgroundRunnerService } from './background-runner.service';

describe(BackgroundRunnerService.name, () => {
  let uut: BackgroundRunnerService;
  let clsService: ClsService;
  let logger: CustomLoggerService;
  let contextManager: AsyncLocalStorageContextManager;

  beforeAll(() => {
    contextManager = new AsyncLocalStorageContextManager().enable();
    context.setGlobalContextManager(contextManager);
  });

  afterAll(() => {
    contextManager.disable();
    context.disable();
  });

  beforeEach(() => {
    clsService = {
      isActive: vi.fn().mockReturnValue(false),
      get: vi.fn(),
      runWith: vi.fn(),
    } as any;
    logger = {
      error: vi.fn(),
    } as any;

    uut = new BackgroundRunnerService(clsService, logger);
  });

  it('should execute the callback', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);

    uut.run(fn);
    await new Promise((resolve) => setImmediate(resolve));

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should run the callback inside the captured CLS store when CLS is active', async () => {
    const store = { someKey: 'someValue' };
    vi.mocked(clsService.isActive).mockReturnValue(true);
    vi.mocked(clsService.get).mockReturnValue(store);
    vi.mocked(clsService.runWith).mockImplementation(
      (_store, callback) => (callback as () => unknown)(),
    );
    const fn = vi.fn().mockResolvedValue(undefined);

    uut.run(fn);
    await new Promise((resolve) => setImmediate(resolve));

    expect(clsService.runWith).toHaveBeenCalledWith(
      store,
      expect.any(Function),
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should run the callback without CLS when no CLS context is active', async () => {
    vi.mocked(clsService.isActive).mockReturnValue(false);
    const fn = vi.fn().mockResolvedValue(undefined);

    uut.run(fn);
    await new Promise((resolve) => setImmediate(resolve));

    expect(clsService.runWith).not.toHaveBeenCalled();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should propagate the OTel context active at call time into the callback', async () => {
    const sentinel = Symbol('sentinel');
    const ctxKey = createContextKey('background-runner-test');
    const expectedContext = context
      .active()
      .setValue(ctxKey, sentinel);
    let observedValue: unknown;

    await context.with(expectedContext, () => {
      uut.run(async () => {
        observedValue = context.active().getValue(ctxKey);
      });
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(observedValue).toBe(sentinel);
  });

  it('should catch and log errors thrown by the callback', async () => {
    const error = new Error('boom');
    const fn = vi.fn().mockRejectedValue(error);

    uut.run(fn);
    await new Promise((resolve) => setImmediate(resolve));

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('boom'),
      expect.objectContaining({
        context: BackgroundRunnerService.name,
        error,
      }),
    );
  });

  it('should not propagate errors to the caller', () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'));

    expect(() => uut.run(fn)).not.toThrow();
  });
});

import { act, renderHook } from '@testing-library/react';

import { useDebouncedValue } from './useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps the previous value until the delay passed without a change', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: 'fan' } },
    );

    rerender({ value: 'fant' });
    act(() => vi.advanceTimersByTime(299));
    rerender({ value: 'fanta' });
    act(() => vi.advanceTimersByTime(299));

    expect(result.current).toBe('fan');

    act(() => vi.advanceTimersByTime(1));

    expect(result.current).toBe('fanta');
  });
});

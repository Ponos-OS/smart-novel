import { fireEvent, render } from '@testing-library/react';

import { useArrowKeyNavigation } from './useArrowKeyNavigation';

function Harness(props: Parameters<typeof useArrowKeyNavigation>[0]) {
  useArrowKeyNavigation(props);

  return (
    <div>
      <input aria-label="search" />
      <audio data-testid="narration" />
    </div>
  );
}

describe('useArrowKeyNavigation', () => {
  it.each([
    ['ArrowLeft', 'onPrevious'],
    ['ArrowRight', 'onNext'],
  ] as const)('%s calls %s', (key, expectedCallback) => {
    // Arrange
    const callbacks = { onPrevious: vi.fn(), onNext: vi.fn() };
    render(<Harness {...callbacks} hasPrevious hasNext />);

    // Act
    fireEvent.keyDown(document.body, { key });

    // Assert
    expect(callbacks[expectedCallback]).toHaveBeenCalledOnce();
    const other =
      expectedCallback === 'onNext' ? 'onPrevious' : 'onNext';
    expect(callbacks[other]).not.toHaveBeenCalled();
  });

  it('does nothing when there is no previous or next chapter', () => {
    // Arrange
    const callbacks = { onPrevious: vi.fn(), onNext: vi.fn() };
    render(
      <Harness {...callbacks} hasPrevious={false} hasNext={false} />,
    );

    // Act
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });

    // Assert
    expect(callbacks.onPrevious).not.toHaveBeenCalled();
    expect(callbacks.onNext).not.toHaveBeenCalled();
  });

  it('ignores keys pressed inside inputs and media elements', () => {
    // Arrange
    const callbacks = { onPrevious: vi.fn(), onNext: vi.fn() };
    const { getByLabelText, getByTestId } = render(
      <Harness {...callbacks} hasPrevious hasNext />,
    );

    // Act
    fireEvent.keyDown(getByLabelText('search'), { key: 'ArrowLeft' });
    fireEvent.keyDown(getByTestId('narration'), {
      key: 'ArrowRight',
    });

    // Assert
    expect(callbacks.onPrevious).not.toHaveBeenCalled();
    expect(callbacks.onNext).not.toHaveBeenCalled();
  });

  it('ignores arrow keys combined with a modifier', () => {
    // Arrange
    const callbacks = { onPrevious: vi.fn(), onNext: vi.fn() };
    render(<Harness {...callbacks} hasPrevious hasNext />);

    // Act
    fireEvent.keyDown(document.body, {
      key: 'ArrowLeft',
      altKey: true,
    });

    // Assert
    expect(callbacks.onPrevious).not.toHaveBeenCalled();
  });
});

import { renderHook } from '@testing-library/react';

import { useRestoreFocus } from './useRestoreFocus';

describe('useRestoreFocus', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  function focusedButton() {
    const button = document.createElement('button');
    document.body.append(button);
    button.focus();

    return button;
  }

  it('puts focus back on the element that had it when the dialog first rendered', () => {
    const opener = focusedButton();
    const { result } = renderHook(() => useRestoreFocus());
    const elsewhere = document.createElement('input');
    document.body.append(elsewhere);
    elsewhere.focus();

    result.current(new Event('focus', { cancelable: true }));

    expect(opener).toHaveFocus();
  });

  it('stops Radix from moving focus to its own trigger', () => {
    focusedButton();
    const { result } = renderHook(() => useRestoreFocus());
    const event = new Event('focus', { cancelable: true });

    result.current(event);

    expect(event.defaultPrevented).toBeTrue();
  });

  it('does nothing when the opener is not an HTML element', () => {
    const dot = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'circle',
    );
    dot.setAttribute('tabindex', '0');
    document.body.append(dot);
    dot.focus();
    const { result } = renderHook(() => useRestoreFocus());
    const other = document.createElement('button');
    document.body.append(other);
    other.focus();

    result.current(new Event('focus', { cancelable: true }));

    expect(other).toHaveFocus();
  });
});

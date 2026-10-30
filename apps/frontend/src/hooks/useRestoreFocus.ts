import { useRef } from 'react';

/**
 * @description
 * Radix puts focus back on its own `Trigger` when a dialog closes, but our dialogs are opened by whatever the page chose, so the element that had focus when the dialog first rendered gets it back instead.
 *
 * Pass the result to `onCloseAutoFocus` of the dialog content.
 */
export function useRestoreFocus() {
  const opener = useRef<Element | null>(document.activeElement);

  return (event: Event) => {
    event.preventDefault();

    if (opener.current instanceof HTMLElement) {
      opener.current.focus();
    }
  };
}

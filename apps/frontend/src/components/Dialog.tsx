import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
} from 'react';

import { Button } from './Button';

interface DialogProps {
  title: string;
  onClose: () => void;
  /** @description The text of the Close button, for a language other than English. */
  closeLabel?: string;
  /** @description For content that needs the room, such as two panes side by side. */
  isWide?: boolean;
  children: ReactNode;
}

const FOCUSABLE_SELECTOR =
  'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [href], [tabindex]:not([tabindex="-1"])';

/**
 * @description A modal the author can leave: Escape, the Close button or a click outside close it, Tab stays inside it, and focus goes back to what opened it.
 */
export function Dialog({
  title,
  onClose,
  closeLabel = 'Close',
  isWide = false,
  children,
}: DialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;

    headerRef.current?.querySelector('button')?.focus();

    return () => opener?.focus?.();
  }, []);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        FOCUSABLE_SELECTOR,
      ) ?? [],
    ).sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
        ? -1
        : 1,
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onKeyDown={handleKeyDown}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`flex max-h-full w-full ${isWide ? 'max-w-6xl' : 'max-w-2xl'} flex-col rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800`}
      >
        <div
          ref={headerRef}
          className="mb-4 flex items-start justify-between gap-4"
        >
          <h2
            id={titleId}
            className="text-lg font-bold text-gray-900 dark:text-white"
          >
            {title}
          </h2>
          <Button
            type="button"
            variant="outline"
            color="gray"
            onClick={onClose}
          >
            {closeLabel}
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

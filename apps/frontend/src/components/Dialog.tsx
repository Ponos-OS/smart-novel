import { Dialog as RadixDialog } from 'radix-ui';
import { type ReactNode } from 'react';

import { useRestoreFocus } from '../hooks/useRestoreFocus';
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

/**
 * @description A modal the author can leave: Escape, the Close button or a click outside close it, Tab stays inside it, and focus goes back to what opened it.
 *
 * It is open for as long as it is mounted; the parent decides when to render it.
 */
export function Dialog({
  title,
  onClose,
  closeLabel = 'Close',
  isWide = false,
  children,
}: DialogProps) {
  const restoreFocus = useRestoreFocus();

  return (
    <RadixDialog.Root
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-gray-950/70 backdrop-blur-sm" />
        <RadixDialog.Content
          // The dialogs have no single description to point to.
          aria-describedby={undefined}
          onCloseAutoFocus={restoreFocus}
          className={`fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-gray-700/70 bg-gray-800 p-6 shadow-2xl shadow-black/40 ${isWide ? 'max-w-6xl' : 'max-w-2xl'}`}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <RadixDialog.Title className="text-lg font-bold text-white">
              {title}
            </RadixDialog.Title>
            <RadixDialog.Close asChild>
              <Button type="button" variant="outline" color="gray">
                {closeLabel}
              </Button>
            </RadixDialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {children}
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

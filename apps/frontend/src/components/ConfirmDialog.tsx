import { Dialog as RadixDialog } from 'radix-ui';
import { ReactNode, useState } from 'react';

import { useRestoreFocus } from '../hooks/useRestoreFocus';
import { Button } from './Button';

interface ConfirmDialogProps {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  /** @description When set, the confirm button stays disabled until this exact text is typed. */
  confirmationText?: string;
  /** @description Shown on the confirm button while loading. */
  loadingLabel?: string;
  isLoading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * @description Asks before something destructive. Escape and Cancel decline it; a click outside does not, so a stray click never loses the choice, and nothing closes while it is loading.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  confirmationText,
  loadingLabel = 'Deleting...',
  isLoading = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const restoreFocus = useRestoreFocus();
  const [typedText, setTypedText] = useState('');
  const isConfirmationMissing =
    confirmationText !== undefined && typedText !== confirmationText;

  return (
    <RadixDialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !isLoading) {
          onCancel();
        }
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-gray-950/70 backdrop-blur-sm" />
        <RadixDialog.Content
          onCloseAutoFocus={restoreFocus}
          onPointerDownOutside={(event) => event.preventDefault()}
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-gray-700/70 bg-gray-800 p-6 shadow-2xl shadow-black/40"
        >
          <RadixDialog.Title className="mb-2 text-lg font-bold text-white">
            {title}
          </RadixDialog.Title>
          <RadixDialog.Description asChild>
            <div className="mb-4 text-sm text-gray-300">
              {message}
            </div>
          </RadixDialog.Description>
          {confirmationText !== undefined && (
            <label className="mb-4 block text-sm text-gray-300">
              <span className="mb-1 block">
                Type <strong>{confirmationText}</strong> to confirm
              </span>
              <input
                type="text"
                value={typedText}
                onChange={(event) => setTypedText(event.target.value)}
                disabled={isLoading}
                className="w-full rounded-lg border px-3 py-2 disabled:opacity-50 border-gray-600 bg-gray-900 text-white"
              />
            </label>
          )}
          {error && (
            <p role="alert" className="mb-4 text-sm text-red-400">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              color="gray"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              color="red"
              onClick={onConfirm}
              disabled={isLoading || isConfirmationMissing}
            >
              {isLoading ? loadingLabel : confirmLabel}
            </Button>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

import { ReactNode, useState } from 'react';

import { Button } from './Button';

interface ConfirmDialogProps {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  /** @description When set, the confirm button stays disabled until this exact text is typed. */
  confirmationText?: string;
  isLoading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  confirmationText,
  isLoading = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typedText, setTypedText] = useState('');
  const isConfirmationMissing =
    confirmationText !== undefined && typedText !== confirmationText;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
        <h2
          id="confirm-dialog-title"
          className="mb-2 text-lg font-bold text-gray-900 dark:text-white"
        >
          {title}
        </h2>
        <div className="mb-4 text-sm text-gray-700 dark:text-gray-300">
          {message}
        </div>
        {confirmationText !== undefined && (
          <label className="mb-4 block text-sm text-gray-700 dark:text-gray-300">
            <span className="mb-1 block">
              Type <strong>{confirmationText}</strong> to confirm
            </span>
            <input
              type="text"
              value={typedText}
              onChange={(event) => setTypedText(event.target.value)}
              disabled={isLoading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </label>
        )}
        {error && (
          <p
            role="alert"
            className="mb-4 text-sm text-red-600 dark:text-red-400"
          >
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
            {isLoading ? 'Deleting...' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

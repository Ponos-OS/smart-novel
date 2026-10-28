import { ReactNode } from 'react';

import { Button } from './Button';

interface ConfirmDialogProps {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  isLoading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  isLoading = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
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
            disabled={isLoading}
          >
            {isLoading ? 'Deleting...' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

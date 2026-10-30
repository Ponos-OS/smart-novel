import { useState } from 'react';

import { useDeleteReadHistoryMutation } from '../../generated/graphql';
import { useAuth } from '../../hooks/useAuth';
import { showApiError, showSuccess } from '../../utils/notification';

export function SettingsPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const { mutate: deleteReadHistory, isPending } =
    useDeleteReadHistoryMutation({
      onSuccess: (data) => {
        setShowConfirmDialog(false);
        const count = data.deleteReadHistory.deletedCount;
        showSuccess(
          count > 0
            ? `Successfully deleted ${count} read history record${count !== 1 ? 's' : ''}.`
            : 'No read history found to delete.',
        );
      },
      onError: () => {
        setShowConfirmDialog(false);
        showApiError();
      },
    });

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-4 text-gray-400">
          You need to be logged in to access settings.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
          Settings
        </h1>
        <p className="mt-1 text-gray-400">
          Manage your account preferences and data.
        </p>
      </div>

      {/* Data & Privacy section */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          Data &amp; Privacy
        </h2>

        <div className="rounded-lg border p-4 shadow-sm border-red-800/50 bg-gray-800 sm:p-6">
          <div className="sm:flex sm:items-start sm:justify-between">
            <div className="mb-4 sm:mb-0 sm:mr-6">
              <h3 className="text-base font-medium text-white">
                Delete Read History
              </h3>
              <p className="mt-1 text-sm text-gray-400">
                Permanently remove all your chapter reading history
                from our servers. This action cannot be undone.
              </p>
              <p className="mt-2 text-xs text-gray-500">
                This is provided for GDPR compliance. Your local
                reading data will not be affected.
              </p>
            </div>
            <div className="flex-shrink-0">
              <button
                onClick={() => setShowConfirmDialog(true)}
                disabled={isPending}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 border-red-700 bg-gray-800 text-red-400 hover:bg-red-900/20 focus:ring-offset-gray-800 sm:w-auto"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Delete Read History
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Confirmation dialog */}
      {showConfirmDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
        >
          <div className="w-full max-w-md rounded-xl p-6 shadow-xl bg-gray-800">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-900/30">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3
                id="confirm-dialog-title"
                className="text-lg font-semibold text-white"
              >
                Are you sure?
              </h3>
            </div>
            <p className="mb-6 text-sm text-gray-400">
              This will permanently delete all your reading history
              from our servers. This action cannot be undone.
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => setShowConfirmDialog(false)}
                disabled={isPending}
                className="cursor-pointer rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600 focus:ring-offset-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteReadHistory({})}
                disabled={isPending}
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 focus:ring-offset-gray-800"
              >
                {isPending ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Deleting…
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    Yes, delete everything
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

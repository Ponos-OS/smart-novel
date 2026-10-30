import { X } from 'lucide-react';
import { Toast } from 'radix-ui';
import { useSyncExternalStore } from 'react';

import {
  dismissNotification,
  getNotifications,
  type NotificationKind,
  subscribeToNotifications,
} from '../utils/notification';

const KIND_CLASSES: Record<NotificationKind, string> = {
  success: 'border-green-700 bg-green-950 text-green-100',
  error: 'border-red-700 bg-red-950 text-red-100',
  info: 'border-blue-700 bg-blue-950 text-blue-100',
};

/**
 * @description Renders the notifications of `utils/notification` in the top right corner; mount it once.
 */
export function Toaster() {
  const notifications = useSyncExternalStore(
    subscribeToNotifications,
    getNotifications,
  );

  return (
    <Toast.Provider label="Notification" swipeDirection="right">
      {notifications.map(
        ({ id, kind, title, description, duration }) => (
          <Toast.Root
            key={id}
            // An error interrupts a screen reader; the rest wait their turn.
            type={kind === 'error' ? 'foreground' : 'background'}
            duration={duration}
            onOpenChange={(open) => {
              if (!open) {
                dismissNotification(id);
              }
            }}
            className={`flex items-start gap-3 rounded-lg border p-4 shadow-lg ${KIND_CLASSES[kind]}`}
          >
            <div className="min-w-0 flex-1">
              <Toast.Title className="text-sm font-semibold">
                {title}
              </Toast.Title>
              <Toast.Description className="mt-1 text-sm opacity-90">
                {description}
              </Toast.Description>
            </div>
            <Toast.Close
              aria-label="Close"
              className="cursor-pointer rounded p-1 opacity-70 transition-opacity hover:opacity-100"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </Toast.Close>
          </Toast.Root>
        ),
      )}
      <Toast.Viewport className="fixed right-4 top-4 z-[100] flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-2 outline-none" />
    </Toast.Provider>
  );
}

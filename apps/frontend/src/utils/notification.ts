export type NotificationKind = 'success' | 'error' | 'info';

export interface Notification {
  id: number;
  kind: NotificationKind;
  title: string;
  description: string;
  /** @description Milliseconds before it closes by itself. */
  duration: number;
}

/**
 * @description
 * A notification is shown from anywhere (a mutation callback, an effect) without a hook, so they live in a small external store that `Toaster` renders with Radix Toast.
 */
let notifications: Notification[] = [];
let nextId = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function show(
  kind: NotificationKind,
  title: string,
  description: string,
  duration: number,
) {
  notifications = [
    ...notifications,
    { id: nextId++, kind, title, description, duration },
  ];
  emit();
}

export function getNotifications(): Notification[] {
  return notifications;
}

export function subscribeToNotifications(
  listener: () => void,
): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

export function dismissNotification(id: number) {
  notifications = notifications.filter(
    (notification) => notification.id !== id,
  );
  emit();
}

export const showApiError = (
  description = 'Something went wrong. Try again later..',
) => {
  show('error', 'ERROR', description, 5000);
};

export const showSuccess = (message: string) => {
  show('success', 'Success', message, 3000);
};

export const showInfo = (message: string) => {
  show('info', 'Info', message, 3000);
};

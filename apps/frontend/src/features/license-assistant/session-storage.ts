import type { LicenseAssistantMessageInput } from '../../generated/graphql';

export interface AssistantSession {
  /** @description The draft the conversation is about. */
  draftId: string;
  conversation: LicenseAssistantMessageInput[];
}

const PREFIX = 'license-assistant:v1:';

/**
 * @description One session per writer on this browser, so a shared computer does not hand one writer's conversation to the next. Storage can be unavailable or full (private windows, blocked site data), and the assistant must work without it.
 */
export function loadSession(userId: string): AssistantSession | null {
  try {
    const stored = JSON.parse(
      localStorage.getItem(PREFIX + userId) ?? 'null',
    );

    return typeof stored?.draftId === 'string' &&
      Array.isArray(stored.conversation)
      ? stored
      : null;
  } catch {
    return null;
  }
}

export function saveSession(
  userId: string,
  session: AssistantSession,
): void {
  try {
    localStorage.setItem(PREFIX + userId, JSON.stringify(session));
  } catch {
    // Not being able to remember the conversation must not stop the author from working.
  }
}

export function clearSession(userId: string): void {
  try {
    localStorage.removeItem(PREFIX + userId);
  } catch {
    // See saveSession.
  }
}

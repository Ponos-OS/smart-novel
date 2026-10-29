import type { FitharaConversationTurn } from '../../../shared';

import {
  LicenseAssistantMessage,
  LicenseAssistantMessageRole,
} from '../types';

export function toFitharaTurn(message: {
  role: LicenseAssistantMessageRole;
  content: string;
}): FitharaConversationTurn {
  return {
    role:
      message.role === LicenseAssistantMessageRole.USER
        ? 'user'
        : 'assistant',
    content: message.content,
  };
}

export function toLicenseAssistantMessage(
  turn: FitharaConversationTurn,
): LicenseAssistantMessage {
  return {
    role:
      turn.role === 'user'
        ? LicenseAssistantMessageRole.USER
        : LicenseAssistantMessageRole.ASSISTANT,
    content: turn.content,
  };
}

import { createContext, type ReactNode, useContext } from 'react';

import {
  enMessages,
  type MessageKey,
  type Messages,
} from './messages';

type Values = Record<string, string | number>;

const MessagesContext = createContext<Messages>(enMessages);

/** @description Gives the assistant another language; without it, it speaks English. */
export function LicenseAssistantMessagesProvider({
  messages,
  children,
}: {
  messages: Messages;
  children: ReactNode;
}) {
  return (
    <MessagesContext.Provider value={messages}>
      {children}
    </MessagesContext.Provider>
  );
}

/** @description Fills `{name}` in a message with a value; a placeholder with no value is left as it is. */
export function format(
  template: string,
  values: Values = {},
): string {
  return template.replace(
    /\{(\w+)\}/g,
    (placeholder, name: string) =>
      name in values ? String(values[name]) : placeholder,
  );
}

export type Translate = (key: MessageKey, values?: Values) => string;

export function useMessages(): Translate {
  const messages = useContext(MessagesContext);

  return (key, values) => format(messages[key], values);
}

import { Tooltip as RadixTooltip } from 'radix-ui';
import { type ReactElement, type ReactNode } from 'react';

interface TooltipProps {
  content: ReactNode;
  /** @description The element that shows the tooltip: it must take a ref and be reachable with the keyboard. */
  children: ReactElement;
  delayDuration?: number;
}

/**
 * @description A hint on hover and keyboard focus, in place of the browser's `title` attribute, which shows late, never on focus and not on touch. Keep the accessible name on the trigger itself (`aria-label` or its text).
 */
export function Tooltip({
  content,
  children,
  delayDuration = 300,
}: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={delayDuration}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>
          {children}
        </RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            sideOffset={6}
            className="z-[100] max-w-xs rounded-md border border-gray-600 bg-gray-900 px-2.5 py-1.5 text-xs text-gray-100 shadow-lg"
          >
            {content}
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}

import { useEffect } from 'react';

interface ArrowKeyNavigationOptions {
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
}

const KEY_OWNING_ELEMENTS = 'input, textarea, select, audio, video';

function isKeyOwnedByTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable || target.matches(KEY_OWNING_ELEMENTS)
  );
}

export function useArrowKeyNavigation({
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
}: ArrowKeyNavigationOptions) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        isKeyOwnedByTarget(event.target)
      ) {
        return;
      }

      if (event.key === 'ArrowLeft' && hasPrevious) {
        onPrevious?.();
      }
      if (event.key === 'ArrowRight' && hasNext) {
        onNext?.();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () =>
      document.removeEventListener('keydown', handleKeyDown);
  }, [onPrevious, onNext, hasPrevious, hasNext]);
}

import { useState } from 'react';

interface KeyDownContext<TOption> {
  options: TOption[];
  onSelect: (option: TOption) => void;
  onRemoveLast: () => void;
}

/**
 * @description
 * The typed text, the open flag and the highlighted option of a multi-select combobox, with its keyboard handling. Enter never submits an enclosing form.
 */
export function useComboboxState() {
  const [text, setText] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const changeText = (next: string) => {
    setText(next);
    setActiveIndex(0);
    setIsOpen(true);
  };

  const reset = () => {
    setText('');
    setActiveIndex(0);
  };

  const handleKeyDown = <TOption>(
    event: React.KeyboardEvent<HTMLInputElement>,
    { options, onSelect, onRemoveLast }: KeyDownContext<TOption>,
  ) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) =>
        options.length === 0 ? 0 : (index + 1) % options.length,
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) =>
        options.length === 0
          ? 0
          : (index - 1 + options.length) % options.length,
      );
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (isOpen && options[activeIndex]) {
        onSelect(options[activeIndex]);
      }
      return;
    }

    if (event.key === 'Escape' && isOpen) {
      event.stopPropagation();
      setIsOpen(false);
      return;
    }

    if (event.key === 'Backspace' && text === '') {
      onRemoveLast();
    }
  };

  return {
    text,
    isOpen,
    setIsOpen,
    activeIndex,
    setActiveIndex,
    changeText,
    reset,
    handleKeyDown,
  };
}

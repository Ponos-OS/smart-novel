import { ComponentPropsWithoutRef } from 'react';

type ButtonVariant = 'chip' | 'solid' | 'outline';
type ButtonColor = 'blue' | 'green' | 'gray' | 'red';

interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant: ButtonVariant;
  color: ButtonColor;
}

const BASE_CLASSES =
  'cursor-pointer font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const VARIANT_CLASSES: Record<string, string> = {
  'chip-green':
    'rounded bg-green-100 px-3 py-1.5 text-xs text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800',
  'chip-blue':
    'rounded bg-blue-100 px-3 py-1.5 text-xs text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800',
  'solid-gray':
    'rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600',
  'solid-blue':
    'rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700',
  'solid-red':
    'rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700',
  'outline-gray':
    'rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700',
};

export function Button({
  variant,
  color,
  className,
  ...buttonProps
}: ButtonProps) {
  const variantClassName = VARIANT_CLASSES[`${variant}-${color}`];

  return (
    <button
      className={[BASE_CLASSES, variantClassName, className]
        .filter(Boolean)
        .join(' ')}
      {...buttonProps}
    />
  );
}

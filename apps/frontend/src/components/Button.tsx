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
    'rounded px-3 py-1.5 text-xs bg-green-900 text-green-200 hover:bg-green-800',
  'chip-blue':
    'rounded px-3 py-1.5 text-xs bg-blue-900 text-blue-200 hover:bg-blue-800',
  'chip-red':
    'rounded px-3 py-1.5 text-xs bg-red-900 text-red-200 hover:bg-red-800',
  'solid-gray':
    'rounded-lg px-4 py-2 text-sm bg-gray-700 text-gray-300 hover:bg-gray-600',
  'solid-blue':
    'rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700',
  'solid-red':
    'rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700',
  'outline-gray':
    'rounded-lg border px-4 py-2 text-sm border-gray-600 text-gray-300 hover:bg-gray-700',
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

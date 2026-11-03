import { cva, type VariantProps } from 'class-variance-authority';
import { ComponentPropsWithoutRef } from 'react';

const button = cva(
  'cursor-pointer font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        chip: 'rounded px-3 py-1.5 text-xs',
        solid: 'rounded-lg px-4 py-2 text-sm',
        outline: 'rounded-lg border px-4 py-2 text-sm',
      },
      color: {
        blue: '',
        green: '',
        gray: '',
        red: '',
      },
    },
    compoundVariants: [
      {
        variant: 'chip',
        color: 'green',
        className: 'bg-green-900 text-green-200 hover:bg-green-800',
      },
      {
        variant: 'chip',
        color: 'blue',
        className: 'bg-blue-900 text-blue-200 hover:bg-blue-800',
      },
      {
        variant: 'chip',
        color: 'red',
        className: 'bg-red-900 text-red-200 hover:bg-red-800',
      },
      {
        variant: 'solid',
        color: 'gray',
        className: 'bg-gray-700 text-gray-300 hover:bg-gray-600',
      },
      {
        variant: 'solid',
        color: 'blue',
        className: 'bg-blue-600 text-white hover:bg-blue-700',
      },
      {
        variant: 'solid',
        color: 'red',
        className: 'bg-red-600 text-white hover:bg-red-700',
      },
      {
        variant: 'outline',
        color: 'gray',
        className: 'border-gray-600 text-gray-300 hover:bg-gray-700',
      },
    ],
  },
);

type ButtonVariants = Required<VariantProps<typeof button>>;

interface ButtonProps
  extends
    Omit<ComponentPropsWithoutRef<'button'>, 'color'>,
    ButtonVariants {}

export function Button({
  variant,
  color,
  className,
  ...buttonProps
}: ButtonProps) {
  return (
    <button
      className={button({ variant, color, className })}
      {...buttonProps}
    />
  );
}

import type { Meta, StoryObj } from '@storybook/react-vite';

import { fn } from 'storybook/test';

import { ConfirmDialog } from './ConfirmDialog';

const meta: Meta<typeof ConfirmDialog> = {
  component: ConfirmDialog,
  title: 'Components/ConfirmDialog',
  args: {
    title: 'Delete chapter',
    message: 'Delete "The Beginning"? This cannot be undone.',
    confirmLabel: 'Delete',
    onConfirm: fn(),
    onCancel: fn(),
  },
};

export default meta;

type Story = StoryObj<typeof ConfirmDialog>;

export const Open: Story = {};

export const Loading: Story = {
  args: { isLoading: true },
};

export const WithError: Story = {
  args: {
    error: 'You do not have permission to delete this chapter',
  },
};

import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, fn, userEvent, within } from 'storybook/test';

import { mockRequestCategoryState } from '../../../.storybook/mocks/request-category-dialog.mock';
import { RequestCategoryDialog } from './RequestCategoryDialog';

const meta: Meta<typeof RequestCategoryDialog> = {
  component: RequestCategoryDialog,
  title: 'Novel/RequestCategoryDialog',
  args: {
    initialName: 'Slice of Life',
    onRequested: fn(),
    onClose: fn(),
  },
  beforeEach: () => {
    mockRequestCategoryState.isPending = false;
    mockRequestCategoryState.outcome = 'noop';
  },
};

export default meta;

type Story = StoryObj<typeof RequestCategoryDialog>;

export const Default: Story = {};

export const Pending: Story = {
  beforeEach: () => {
    mockRequestCategoryState.isPending = true;
  },
};

export const AlreadyExists: Story = {
  args: { initialName: 'Fantasy' },
  beforeEach: () => {
    mockRequestCategoryState.outcome = 'refused';
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);

    await userEvent.click(
      canvas.getByRole('button', { name: 'Request category' }),
    );

    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'The category "fantasy" already exists',
    );
  },
};

export const Requested: Story = {
  beforeEach: () => {
    mockRequestCategoryState.outcome = 'success';
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement.ownerDocument.body);

    await userEvent.click(
      canvas.getByRole('button', { name: 'Request category' }),
    );

    await expect(args.onRequested).toHaveBeenCalledOnce();
  },
};

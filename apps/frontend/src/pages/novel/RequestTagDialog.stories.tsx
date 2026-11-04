import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, fn, userEvent, within } from 'storybook/test';

import { mockRequestTagState } from '../../../.storybook/mocks/request-tag-dialog.mock';
import { RequestTagDialog } from './RequestTagDialog';

const meta: Meta<typeof RequestTagDialog> = {
  component: RequestTagDialog,
  title: 'Novel/RequestTagDialog',
  args: {
    initialName: 'Slice of Life',
    onRequested: fn(),
    onClose: fn(),
  },
  beforeEach: () => {
    mockRequestTagState.isPending = false;
    mockRequestTagState.outcome = 'noop';
  },
};

export default meta;

type Story = StoryObj<typeof RequestTagDialog>;

export const Default: Story = {};

export const Pending: Story = {
  beforeEach: () => {
    mockRequestTagState.isPending = true;
  },
};

export const AlreadyExists: Story = {
  args: { initialName: 'Fantasy' },
  beforeEach: () => {
    mockRequestTagState.outcome = 'refused';
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);

    await userEvent.click(
      canvas.getByRole('button', { name: 'Request tag' }),
    );

    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'The tag "fantasy" already exists',
    );
  },
};

export const Requested: Story = {
  beforeEach: () => {
    mockRequestTagState.outcome = 'success';
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement.ownerDocument.body);

    await userEvent.click(
      canvas.getByRole('button', { name: 'Request tag' }),
    );

    await expect(args.onRequested).toHaveBeenCalledOnce();
  },
};

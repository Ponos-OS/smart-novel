import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, fn, within } from 'storybook/test';

import { WriterRequestStatus } from '../../generated/graphql';
import { WriterAccessCard } from './WriterAccessCard';

const meta: Meta<typeof WriterAccessCard> = {
  component: WriterAccessCard,
  title: 'WriterRequest/WriterAccessCard',
  args: { onRequest: fn() },
};

export default meta;

type Story = StoryObj<typeof WriterAccessCard>;

export const NeverAsked: Story = {
  args: { request: null },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', {
        name: 'Become a writer',
      }),
    ).toBeInTheDocument();
  },
};

export const Pending: Story = {
  args: { request: { status: WriterRequestStatus.Pending } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('Request pending'),
    ).toBeInTheDocument();
  },
};

export const RejectedWithReason: Story = {
  args: {
    request: {
      status: WriterRequestStatus.Rejected,
      rejectionReason: 'Please share a sample chapter.',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByText('Please share a sample chapter.'),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'Request again' }),
    ).toBeInTheDocument();
  },
};

export const Approved: Story = {
  args: { request: { status: WriterRequestStatus.Approved } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/Sign out and sign in again/),
    ).toBeInTheDocument();
  },
};

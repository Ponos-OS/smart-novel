import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, fn, userEvent, within } from 'storybook/test';

import { mockRequestWriterAccessState } from '../../../.storybook/mocks/request-writer-access-dialog.mock';
import { RequestWriterAccessDialog } from './RequestWriterAccessDialog';

const meta: Meta<typeof RequestWriterAccessDialog> = {
  component: RequestWriterAccessDialog,
  title: 'Writer/RequestWriterAccessDialog',
  args: {
    onRequested: fn(),
    onClose: fn(),
  },
  beforeEach: () => {
    mockRequestWriterAccessState.isPending = false;
    mockRequestWriterAccessState.outcome = 'noop';
  },
};

export default meta;

type Story = StoryObj<typeof RequestWriterAccessDialog>;

export const Empty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);

    await expect(
      canvas.getByRole('button', { name: 'Send request' }),
    ).toBeDisabled();
  },
};

export const Typing: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);

    await userEvent.type(
      canvas.getByLabelText('Pen name'),
      'Mina_Ardalan',
    );
    await userEvent.type(
      canvas.getByLabelText('Why do you want to write here?'),
      'I serialize a fantasy web novel.',
    );

    await expect(canvas.getByText('32 / 1000')).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'Send request' }),
    ).toBeEnabled();
  },
};

export const Pending: Story = {
  beforeEach: () => {
    mockRequestWriterAccessState.isPending = true;
  },
};

export const AlreadyPending: Story = {
  beforeEach: () => {
    mockRequestWriterAccessState.outcome = 'refused';
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);

    await userEvent.type(
      canvas.getByLabelText('Pen name'),
      'Mina_Ardalan',
    );
    await userEvent.type(
      canvas.getByLabelText('Why do you want to write here?'),
      'Hello',
    );
    await userEvent.click(
      canvas.getByRole('button', { name: 'Send request' }),
    );

    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'You already have a pending writer request',
    );
  },
};

export const Requested: Story = {
  beforeEach: () => {
    mockRequestWriterAccessState.outcome = 'success';
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement.ownerDocument.body);

    await userEvent.type(
      canvas.getByLabelText('Pen name'),
      'Mina_Ardalan',
    );
    await userEvent.type(
      canvas.getByLabelText('Why do you want to write here?'),
      'Hello',
    );
    await userEvent.click(
      canvas.getByRole('button', { name: 'Send request' }),
    );

    await expect(args.onRequested).toHaveBeenCalledOnce();
  },
};

export const InvalidPenName: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);

    await userEvent.type(canvas.getByLabelText('Pen name'), 'Mina2');
    await userEvent.type(
      canvas.getByLabelText('Why do you want to write here?'),
      'Hello',
    );

    await expect(canvas.getByLabelText('Pen name')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    await expect(
      canvas.getByText(/English letters, hyphens and underscores/),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'Send request' }),
    ).toBeDisabled();
  },
};

export const PenNameTaken: Story = {
  beforeEach: () => {
    mockRequestWriterAccessState.outcome = 'taken';
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);

    await userEvent.type(
      canvas.getByLabelText('Pen name'),
      'Mina_Ardalan',
    );
    await userEvent.type(
      canvas.getByLabelText('Why do you want to write here?'),
      'Hello',
    );
    await userEvent.click(
      canvas.getByRole('button', { name: 'Send request' }),
    );

    await expect(canvas.getByLabelText('Pen name')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  },
};

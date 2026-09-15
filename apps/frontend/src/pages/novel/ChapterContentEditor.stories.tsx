import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { userEvent, within } from 'storybook/test';

import { mockMutationState } from '../../../.storybook/mocks/chapter-content-editor.mock';
import { ChapterContentEditor } from './ChapterContentEditor';

const sampleChapter = {
  id: '4dd92f16-4743-47b9-960c-6529678e9bc5',
  novelId: 'c1d31ec2-f478-4648-b90b-d1e53de2a829',
  title: 'The Long Road Home',
  content:
    '## A New Beginning\n\nThe path ahead was **uncertain**, but she walked on regardless.\n\n- Pack light\n- Trust no one\n- Keep moving',
  updatedAt: '2026-01-01T00:00:00.000Z',
  contentUpdatedAt: '2026-01-01T00:00:00.000Z',
};

const meta: Meta<typeof ChapterContentEditor> = {
  component: ChapterContentEditor,
  title: 'Novel/ChapterContentEditor',
  args: {
    chapter: sampleChapter,
    canEdit: true,
  },
  decorators: [
    (Story) => {
      mockMutationState.isPending = false;
      const queryClient = new QueryClient();

      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      );
    },
  ],
};

export default meta;

type Story = StoryObj<typeof ChapterContentEditor>;

export const ReadOnly: Story = {};

export const Editing: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Edit' }),
    );
  },
};

export const Preview: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Edit' }),
    );
    await userEvent.click(
      canvas.getByRole('button', { name: 'Preview' }),
    );
  },
};

export const Saving: Story = {
  decorators: [
    (Story) => {
      mockMutationState.isPending = true;
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Edit' }),
    );
  },
};

import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { ComponentType } from 'react';
import {
  createMemoryRouter,
  RouterProvider,
  useNavigate,
} from 'react-router-dom';
import { expect, fn, userEvent, within } from 'storybook/test';

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

/**
 * `ChapterContentEditor` uses `useBlocker` (to prompt before leaving a dirty edit session), which only works inside a data router.
 * Wraps every story in one, with a second `/elsewhere` route to land on after a confirmed navigation.
 */
function RouterDecorator(Story: ComponentType) {
  const router = createMemoryRouter([
    { path: '/', element: <Story /> },
    { path: '/elsewhere', element: <div>Elsewhere</div> },
  ]);

  return <RouterProvider router={router} />;
}

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
      mockMutationState.outcome = 'noop';
      const queryClient = new QueryClient();

      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      );
    },
    RouterDecorator,
  ],
};

export default meta;

type Story = StoryObj<typeof ChapterContentEditor>;

export const ReadOnly: Story = {};

export const ClickingEditNavigatesAway: Story = {
  name: 'Clicking Edit navigates to the edit route (no inline editing)',
  args: {
    onEditClick: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Edit' }),
    );

    await expect(args.onEditClick).toHaveBeenCalled();
    // Still read-only — clicking Edit does not switch into inline editing.
    await expect(
      canvas.queryByPlaceholderText('Chapter title'),
    ).toBeNull();
  },
};

export const Editing: Story = {
  args: { startInEditMode: true },
};

export const Preview: Story = {
  args: { startInEditMode: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Preview' }),
    );
  },
};

export const Saving: Story = {
  args: { startInEditMode: true },
  decorators: [
    (Story) => {
      mockMutationState.isPending = true;
      return <Story />;
    },
  ],
};

export const SaveConflict: Story = {
  name: 'Save conflict shows "Reload latest" instead of a generic error',
  args: { startInEditMode: true },
  decorators: [
    (Story) => {
      mockMutationState.outcome = 'conflict';
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByPlaceholderText('Chapter title'),
      ' (edited)',
    );
    await userEvent.click(
      canvas.getByRole('button', { name: 'Save' }),
    );
  },
};

export const ReloadingLatest: Story = {
  name: 'Reload latest stays on the edit view while refetching',
  args: { startInEditMode: true },
  decorators: [
    (Story) => {
      mockMutationState.outcome = 'conflict';
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByPlaceholderText('Chapter title'),
      ' (edited)',
    );
    await userEvent.click(
      canvas.getByRole('button', { name: 'Save' }),
    );
    await userEvent.click(
      canvas.getByRole('button', { name: 'Reload latest' }),
    );
  },
};

/**
 * Cancel (or any other in-app navigation) with unsaved changes is blocked by the
 * router-level `useBlocker` guard, which shows this same confirmation regardless of
 * what triggered the navigation attempt.
 */
export const DiscardConfirmation: Story = {
  name: 'Cancel with unsaved changes prompts before discarding',
  args: { startInEditMode: true },
  render: (args) => {
    function WithNavigatingCancel() {
      const navigate = useNavigate();
      return (
        <ChapterContentEditor
          {...args}
          onCancel={() => navigate('/elsewhere')}
        />
      );
    }
    return <WithNavigatingCancel />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByPlaceholderText('Chapter title'),
      ' (edited)',
    );
    await userEvent.click(
      canvas.getByRole('button', { name: 'Cancel' }),
    );
  },
};

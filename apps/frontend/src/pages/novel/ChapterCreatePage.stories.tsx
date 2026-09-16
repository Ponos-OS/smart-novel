import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { ComponentType } from 'react';
import {
  createMemoryRouter,
  Outlet,
  RouterProvider,
} from 'react-router-dom';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { mockCreateChapterMutationState } from '../../../.storybook/mocks/chapter-create-page.mock';
import { ChapterCreatePage } from './ChapterCreatePage';

const NOVEL_ID = 'c1d31ec2-f478-4648-b90b-d1e53de2a829';

/**
 * `ChapterCreatePage` reads `novel`/`canEditContent` via `useNovelOutletContext`
 * (react-router's `useOutletContext`), so stories need a real nested route
 * whose parent renders `<Outlet context={...} />` — and a data router for
 * `useNavigate` to work at all.
 */
function RouterDecorator(Story: ComponentType) {
  const router = createMemoryRouter([
    {
      path: '/',
      element: (
        <Outlet
          context={{
            novel: { id: NOVEL_ID },
            canEditContent: true,
            canManageTts: false,
          }}
        />
      ),
      children: [
        { index: true, element: <Story /> },
        {
          path: `novel/${NOVEL_ID}/chapters/:chapterId/edit`,
          element: <div>Edit page</div>,
        },
      ],
    },
  ]);

  return <RouterProvider router={router} />;
}

const meta: Meta<typeof ChapterCreatePage> = {
  component: ChapterCreatePage,
  title: 'Novel/ChapterCreatePage',
  decorators: [
    (Story) => {
      mockCreateChapterMutationState.isPending = false;
      mockCreateChapterMutationState.outcome = 'noop';
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

type Story = StoryObj<typeof ChapterCreatePage>;

export const Empty: Story = {};

export const Filled: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByPlaceholderText('Chapter title'),
      'Chapter 1: The Beginning',
    );
    await userEvent.type(
      canvas.getByPlaceholderText(
        'Chapter content in markdown format',
      ),
      '# Chapter 1\n\nIt was a dark and stormy night.',
    );
  },
};

export const Saving: Story = {
  decorators: [
    (Story) => {
      mockCreateChapterMutationState.isPending = true;
      return <Story />;
    },
  ],
};

export const SubmitError: Story = {
  name: 'Submit failure shows an API error toast',
  decorators: [
    (Story) => {
      mockCreateChapterMutationState.outcome = 'error';
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByPlaceholderText('Chapter title'),
      'Chapter 1',
    );
    await userEvent.type(
      canvas.getByPlaceholderText(
        'Chapter content in markdown format',
      ),
      'Some content.',
    );
    await userEvent.click(
      canvas.getByRole('button', { name: 'Create Chapter' }),
    );

    // The form stays on the page — the toast itself renders outside canvasElement.
    await expect(
      canvas.getByRole('button', { name: 'Create Chapter' }),
    ).toBeTruthy();
  },
};

export const SubmitSuccessNavigatesToEditPage: Story = {
  name: 'Successful submit navigates to the new chapter’s edit page',
  decorators: [
    (Story) => {
      mockCreateChapterMutationState.outcome = 'success';
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByPlaceholderText('Chapter title'),
      'Chapter 1: The Beginning',
    );
    await userEvent.type(
      canvas.getByPlaceholderText(
        'Chapter content in markdown format',
      ),
      '# Chapter 1\n\nIt was a dark and stormy night.',
    );
    await userEvent.click(
      canvas.getByRole('button', { name: 'Create Chapter' }),
    );

    await waitFor(() =>
      expect(canvas.getByText('Edit page')).toBeTruthy(),
    );
  },
};

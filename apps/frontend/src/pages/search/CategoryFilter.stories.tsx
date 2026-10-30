import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, fn, userEvent, within } from 'storybook/test';

import { CategoryFilter } from './CategoryFilter';

const meta: Meta<typeof CategoryFilter> = {
  component: CategoryFilter,
  title: 'Search/CategoryFilter',
  args: {
    availableCategories: [
      { name: 'Adventure', approximateNovelCount: 412 },
      { name: 'Fantasy', approximateNovelCount: 12034 },
      { name: 'Mystery', approximateNovelCount: 87 },
      { name: 'Romance', approximateNovelCount: 1 },
    ],
    includeCategories: [],
    excludeCategories: [],
    onToggleInclude: fn(),
    onToggleExclude: fn(),
    onShowMore: fn(),
  },
  decorators: [
    (Story) => (
      <div className="max-w-3xl rounded-lg border border-gray-700 bg-gray-800 p-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof CategoryFilter>;

export const WithCounts: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getAllByText('~12K')).toHaveLength(2);
    await expect(canvas.getAllByText('~1')).toHaveLength(2);
  },
};

export const Selected: Story = {
  args: {
    includeCategories: ['Fantasy'],
    excludeCategories: ['Romance'],
  },
};

export const WithMore: Story = {
  args: { hasMore: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getByRole('button', { name: 'Show more categories' }),
    );

    await expect(args.onShowMore).toHaveBeenCalledOnce();
  },
};

export const LoadingMore: Story = {
  args: { hasMore: true, isLoadingMore: true },
};

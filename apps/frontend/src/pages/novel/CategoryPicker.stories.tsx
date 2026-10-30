import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { ComponentType, useState } from 'react';
import {
  expect,
  fn,
  userEvent,
  waitFor,
  within,
} from 'storybook/test';

import { CategoryPicker } from './CategoryPicker';

const page = (names: string[], hasNextPage = false) => ({
  pages: [
    {
      categoriesConnection: {
        edges: names.map((name) => ({
          node: { id: `id-${name}`, name },
        })),
        pageInfo: {
          endCursor: hasNextPage ? 'cursor-1' : null,
          hasNextPage,
        },
      },
    },
  ],
  pageParams: [undefined],
});

/** @description The suggestions come from the query cache, so the stories need no API. */
function SeededQueryDecorator(Story: ComponentType) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { staleTime: Infinity, retry: false },
    },
  });

  client.setQueryData(
    ['SearchCategoriesInfinite', ''],
    page(['adventure', 'fantasy', 'mystery', 'romance'], true),
  );
  client.setQueryData(
    ['SearchCategoriesInfinite', 'fan'],
    page(['fantasy']),
  );
  client.setQueryData(['SearchCategoriesInfinite', 'zzz'], page([]));

  return (
    <QueryClientProvider client={client}>
      <div className="max-w-xl p-6">
        <Story />
      </div>
    </QueryClientProvider>
  );
}

function Controlled(props: Parameters<typeof CategoryPicker>[0]) {
  const [value, setValue] = useState(props.value);

  return (
    <CategoryPicker
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
        props.onChange(next);
      }}
    />
  );
}

const meta: Meta<typeof CategoryPicker> = {
  component: CategoryPicker,
  title: 'Novel/CategoryPicker',
  decorators: [SeededQueryDecorator],
  args: { value: [], onChange: fn(), onRequestCategory: fn() },
  render: (args) => <Controlled {...args} />,
};

export default meta;

type Story = StoryObj<typeof CategoryPicker>;

export const Empty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('combobox'));

    await expect(await canvas.findAllByRole('option')).toHaveLength(
      4,
    );
    await expect(
      canvas.getByRole('button', { name: 'More' }),
    ).toBeVisible();
  },
};

export const Typing: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByRole('combobox'), 'fan');

    await waitFor(() =>
      expect(canvas.getAllByRole('option')).toHaveLength(1),
    );
    await expect(
      canvas.getByRole('option', { name: 'fantasy' }),
    ).toBeVisible();
  },
};

export const NoMatch: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByRole('combobox'), 'zzz');

    await expect(
      await canvas.findByRole('button', { name: 'Request category' }),
    ).toBeVisible();
  },
};

export const Selected: Story = {
  args: { value: ['fantasy', 'mystery'] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('combobox'));

    await expect(await canvas.findAllByRole('option')).toHaveLength(
      2,
    );
    await expect(
      canvas.getByRole('button', { name: 'Remove fantasy' }),
    ).toBeVisible();
  },
};

export const Disabled: Story = {
  args: { value: ['fantasy'], disabled: true },
};

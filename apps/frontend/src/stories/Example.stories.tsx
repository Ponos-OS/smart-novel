import type { Meta, StoryObj } from '@storybook/react-vite';

/** Minimal example story confirming the Storybook setup works. */
function Example({ label }: { label: string }) {
  return <p className="p-4 text-sm text-gray-900">{label}</p>;
}

const meta: Meta<typeof Example> = {
  component: Example,
  title: 'Example',
};

export default meta;

type Story = StoryObj<typeof Example>;

export const Default: Story = {
  args: {
    label: 'Storybook is set up.',
  },
};

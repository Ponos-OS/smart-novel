import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  title: 'Components/Button',
  args: {
    children: 'Button',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['chip', 'solid', 'outline'],
    },
    color: {
      control: 'select',
      options: ['blue', 'green', 'gray', 'red'],
    },
  },
};

export default meta;

type Story = StoryObj<typeof Button>;

export const ChipBlue: Story = {
  args: { variant: 'chip', color: 'blue', children: 'Edit' },
};

export const ChipGreen: Story = {
  args: {
    variant: 'chip',
    color: 'green',
    children: '🔊 Generate Audio',
  },
};

export const SolidGray: Story = {
  args: { variant: 'solid', color: 'gray', children: '← Previous' },
};

export const SolidBlue: Story = {
  args: { variant: 'solid', color: 'blue', children: 'Save' },
};

export const SolidRed: Story = {
  args: {
    variant: 'solid',
    color: 'red',
    children: 'Yes, Regenerate',
  },
};

export const OutlineGray: Story = {
  args: { variant: 'outline', color: 'gray', children: 'Cancel' },
};

export const Disabled: Story = {
  args: {
    variant: 'chip',
    color: 'blue',
    children: 'Edit',
    disabled: true,
  },
};

/** All variant/color combinations used across the app, side by side, so a mismatch is spotted at a glance instead of by comparing pages. */
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <Button variant="chip" color="blue">
        Edit
      </Button>
      <Button variant="chip" color="green">
        🔊 Generate Audio
      </Button>
      <Button variant="solid" color="gray">
        ← Previous
      </Button>
      <Button variant="solid" color="blue">
        Save
      </Button>
      <Button variant="solid" color="red">
        Yes, Regenerate
      </Button>
      <Button variant="outline" color="gray">
        Cancel
      </Button>
    </div>
  ),
};

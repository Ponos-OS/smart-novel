import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, userEvent, within } from 'storybook/test';

import { Button } from './Button';
import { Tooltip } from './Tooltip';

const meta: Meta<typeof Tooltip> = {
  component: Tooltip,
  title: 'Components/Tooltip',
  args: {
    content: 'Delete chapter',
    children: (
      <Button variant="chip" color="red">
        Delete
      </Button>
    ),
  },
  decorators: [
    (Story) => (
      <div className="p-12">
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof Tooltip>;

export const OnHover: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.hover(
      canvas.getByRole('button', { name: 'Delete' }),
    );

    await expect(
      await within(canvasElement.ownerDocument.body).findByRole(
        'tooltip',
      ),
    ).toHaveTextContent('Delete chapter');
  },
};

import type { Meta, StoryObj } from '@storybook/react-vite';

import { fn } from 'storybook/test';

import { NovelState } from '../../generated/graphql';
import { NovelForm } from './NovelForm';

const meta: Meta<typeof NovelForm> = {
  component: NovelForm,
  title: 'Novel/NovelForm',
  args: {
    submitLabel: 'Create novel',
    isSubmitting: false,
    onSubmit: fn(),
    onCancel: fn(),
  },
};

export default meta;

type Story = StoryObj<typeof NovelForm>;

export const Empty: Story = {};

export const Prefilled: Story = {
  args: {
    submitLabel: 'Save',
    initialValues: {
      name: 'The Lantern Keeper',
      description: 'A lighthouse keeper finds a door in the fog.',
      state: NovelState.Finished,
      categories: ['fantasy', 'adventure'],
    },
  },
};

export const Submitting: Story = {
  args: {
    isSubmitting: true,
    initialValues: {
      name: 'The Lantern Keeper',
      description: 'A lighthouse keeper finds a door in the fog.',
      state: NovelState.Ongoing,
      categories: ['fantasy'],
    },
  },
};

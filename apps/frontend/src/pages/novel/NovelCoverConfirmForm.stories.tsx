import type { Meta, StoryObj } from '@storybook/react-vite';

import { fn } from 'storybook/test';

import { NovelCoverConfirmForm } from './NovelCoverConfirmForm';

const PREVIEW =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="192" height="256"><rect width="192" height="256" fill="#3b82f6"/><text x="96" y="132" font-size="20" fill="white" text-anchor="middle">Cover</text></svg>',
  );

const meta: Meta<typeof NovelCoverConfirmForm> = {
  component: NovelCoverConfirmForm,
  title: 'Novel/NovelCoverConfirmForm',
  args: {
    previewUrl: PREVIEW,
    fileName: 'lantern-keeper-cover.png',
    fileSize: 204800,
    isUploading: false,
    error: null,
    onConfirm: fn(),
    onCancel: fn(),
  },
};

export default meta;

type Story = StoryObj<typeof NovelCoverConfirmForm>;

export const Picked: Story = {};

export const Uploading: Story = {
  args: { isUploading: true },
};

export const WithError: Story = {
  args: { error: 'The upload was rejected (403).' },
};

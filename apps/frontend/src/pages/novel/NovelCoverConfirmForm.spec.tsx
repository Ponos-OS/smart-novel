import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { NovelCoverConfirmForm } from './NovelCoverConfirmForm';

describe(NovelCoverConfirmForm.name, () => {
  function renderForm(
    overrides: Partial<
      Parameters<typeof NovelCoverConfirmForm>[0]
    > = {},
  ) {
    const props = {
      previewUrl:
        'blob:http://localhost:4200/6f1c2a9e-5d3b-4c8e-9a47-0b2d1e7f3a58',
      fileName: 'lighthouse-cover.webp',
      fileSize: 2_411_724,
      isUploading: false,
      error: null,
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
      ...overrides,
    };

    return {
      user: userEvent.setup(),
      props,
      ...render(<NovelCoverConfirmForm {...props} />),
    };
  }

  it('shows the file name, its size and a preview', () => {
    renderForm();

    expect(
      screen.getByText('lighthouse-cover.webp'),
    ).toBeInTheDocument();
    expect(screen.getByText('2.3 MB')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Selected cover preview' }),
    ).toHaveAttribute('src', expect.stringContaining('blob:'));
  });

  it('shows no preview when there is no url', () => {
    renderForm({ previewUrl: null });

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('confirms with the button and without reloading the page', async () => {
    const { user, props } = renderForm();

    await user.click(
      screen.getByRole('button', { name: 'Use this cover' }),
    );

    expect(props.onConfirm).toHaveBeenCalledOnce();
  });

  it('cancels without confirming', async () => {
    const { user, props } = renderForm();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(props.onCancel).toHaveBeenCalledOnce();
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('announces an error', () => {
    renderForm({ error: 'The cover must be smaller than 5 MB.' });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The cover must be smaller than 5 MB.',
    );
  });

  it('says nothing when there is no error', () => {
    renderForm();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('locks both buttons while it uploads', async () => {
    const { user, props } = renderForm({ isUploading: true });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(
      screen.getByRole('button', { name: 'Uploading...' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Cancel' }),
    ).toBeDisabled();
    expect(props.onCancel).not.toHaveBeenCalled();
  });
});

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  dismissNotification,
  getNotifications,
  showApiError,
  showInfo,
  showSuccess,
} from '../utils/notification';
import { Toaster } from './Toaster';

function clearNotifications() {
  for (const { id } of getNotifications()) {
    dismissNotification(id);
  }
}

describe('Toaster', () => {
  afterEach(() => act(clearNotifications));

  it('shows a notification raised after it was mounted', () => {
    render(<Toaster />);

    act(() => showSuccess('The default license was changed.'));

    expect(screen.getByText('Success')).toBeVisible();
    expect(
      screen.getByText('The default license was changed.'),
    ).toBeVisible();
  });

  it.each([
    {
      name: 'an api error',
      raise: () => showApiError(),
      title: 'ERROR',
      description: 'Something went wrong. Try again later..',
    },
    {
      name: 'an api error with its own description',
      raise: () =>
        showApiError('The categories could not be loaded.'),
      title: 'ERROR',
      description: 'The categories could not be loaded.',
    },
    {
      name: 'an info',
      raise: () => showInfo('Saved as a draft.'),
      title: 'Info',
      description: 'Saved as a draft.',
    },
  ])('shows $name', ({ raise, title, description }) => {
    render(<Toaster />);

    act(raise);

    expect(screen.getByText(title)).toBeVisible();
    expect(screen.getByText(description)).toBeVisible();
  });

  it('stacks several notifications', () => {
    render(<Toaster />);

    act(() => {
      showSuccess('One');
      showInfo('Two');
    });

    expect(screen.getByText('One')).toBeVisible();
    expect(screen.getByText('Two')).toBeVisible();
  });

  it('closes a notification with its Close button', async () => {
    const user = userEvent.setup();
    render(<Toaster />);
    act(() => showSuccess('One'));

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByText('One')).not.toBeInTheDocument();
    expect(getNotifications()).toBeEmpty();
  });

  it('shows the notifications that were raised before it mounted', () => {
    showInfo('Early');

    render(<Toaster />);

    expect(screen.getByText('Early')).toBeVisible();
  });
});

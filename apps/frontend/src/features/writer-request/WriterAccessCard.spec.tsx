import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { WriterRequestStatus } from '../../generated/graphql';
import { WriterAccessCard } from './WriterAccessCard';

describe('WriterAccessCard', () => {
  it('offers the button to a user who never asked', async () => {
    const onRequest = vi.fn();
    render(<WriterAccessCard request={null} onRequest={onRequest} />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Become a writer' }),
    );

    expect(onRequest).toHaveBeenCalledOnce();
  });

  it('replaces the button with a badge while the request is pending', () => {
    render(
      <WriterAccessCard
        request={{ status: WriterRequestStatus.Pending }}
        onRequest={vi.fn()}
      />,
    );

    expect(screen.getByText('Request pending')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows the reason of a rejection and lets the user ask again', async () => {
    const onRequest = vi.fn();
    render(
      <WriterAccessCard
        request={{
          status: WriterRequestStatus.Rejected,
          rejectionReason: 'Please share a sample chapter.',
        }}
        onRequest={onRequest}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Request again' }),
    );

    expect(
      screen.getByText('Please share a sample chapter.'),
    ).toBeInTheDocument();
    expect(onRequest).toHaveBeenCalledOnce();
  });

  it('lets the user ask again after a rejection without a reason', () => {
    render(
      <WriterAccessCard
        request={{
          status: WriterRequestStatus.Rejected,
          rejectionReason: null,
        }}
        onRequest={vi.fn()}
      />,
    );

    expect(
      screen.getByText('Your request was not approved'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Request again' }),
    ).toBeInTheDocument();
  });

  it('tells an approved user to sign out and in again', () => {
    render(
      <WriterAccessCard
        request={{ status: WriterRequestStatus.Approved }}
        onRequest={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/Sign out and sign in again/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useDeleteReadHistoryMutation } from '../../generated/graphql';
import { useAuth } from '../../hooks/useAuth';
import { showApiError, showSuccess } from '../../utils/notification';
import { SettingsPage } from './SettingsPage';

vi.mock('../../hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../../utils/notification', () => ({
  showSuccess: vi.fn(),
  showApiError: vi.fn(),
}));
vi.mock('../../features/writer/WriterAccessSection', () => ({
  WriterAccessSection: () => <section>writer access</section>,
}));
vi.mock('../../generated/graphql', async () => ({
  ...(await vi.importActual<object>('../../generated/graphql')),
  useDeleteReadHistoryMutation: vi.fn(),
}));

type MutationOptions = Parameters<
  typeof useDeleteReadHistoryMutation
>[0];

describe(SettingsPage.name, () => {
  const mutate = vi.fn();
  let options: NonNullable<MutationOptions>;

  function givenViewer(auth: {
    isAuthenticated: boolean;
    loading: boolean;
  }) {
    vi.mocked(useAuth).mockReturnValue(auth as never);
  }

  function givenMutation(isPending = false) {
    vi.mocked(useDeleteReadHistoryMutation).mockImplementation(((
      received: MutationOptions,
    ) => {
      options = received as NonNullable<MutationOptions>;

      return { mutate, isPending };
    }) as never);
  }

  async function openDialog() {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await user.click(
      screen.getByRole('button', { name: 'Delete Read History' }),
    );

    return user;
  }

  beforeEach(() => {
    givenViewer({ isAuthenticated: true, loading: false });
    givenMutation();
  });

  afterEach(() => vi.clearAllMocks());

  it('shows nothing but a spinner while the viewer is loading', () => {
    givenViewer({ isAuthenticated: false, loading: true });

    render(<SettingsPage />);

    expect(
      screen.queryByRole('heading', { name: 'Settings' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/logged in/)).not.toBeInTheDocument();
  });

  it('asks an anonymous viewer to log in', () => {
    givenViewer({ isAuthenticated: false, loading: false });

    render(<SettingsPage />);

    expect(
      screen.getByText(
        'You need to be logged in to access settings.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('writer access'),
    ).not.toBeInTheDocument();
  });

  it('shows the writer access and the data section to a logged in viewer', () => {
    render(<SettingsPage />);

    expect(screen.getByText('writer access')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete Read History' }),
    ).toBeInTheDocument();
  });

  it('asks for a confirmation before it deletes anything', async () => {
    await openDialog();

    expect(
      screen.getByRole('dialog', { name: 'Are you sure?' }),
    ).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('leaves the history alone when the viewer cancels', async () => {
    const user = await openDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('deletes the history once the viewer confirms', async () => {
    const user = await openDialog();

    await user.click(
      screen.getByRole('button', { name: 'Yes, delete everything' }),
    );

    expect(mutate).toHaveBeenCalledExactlyOnceWith({});
  });

  it.each([
    {
      deletedCount: 0,
      message: 'No read history found to delete.',
    },
    {
      deletedCount: 1,
      message: 'Successfully deleted 1 read history record.',
    },
    {
      deletedCount: 42,
      message: 'Successfully deleted 42 read history records.',
    },
  ])(
    'closes the dialog and reports "$message" for $deletedCount deleted',
    async ({ deletedCount, message }) => {
      await openDialog();

      act(() =>
        options?.onSuccess?.(
          { deleteReadHistory: { deletedCount } } as never,
          {} as never,
          undefined as never,
          undefined as never,
        ),
      );

      expect(showSuccess).toHaveBeenCalledExactlyOnceWith(message);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    },
  );

  it('closes the dialog and reports the failure when deleting fails', async () => {
    await openDialog();

    act(() =>
      options?.onError?.(
        new Error('down'),
        {} as never,
        undefined as never,
        undefined as never,
      ),
    );

    expect(showApiError).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('locks the buttons while the deletion is on its way', () => {
    givenMutation(true);

    render(<SettingsPage />);

    expect(
      screen.getByRole('button', { name: 'Delete Read History' }),
    ).toBeDisabled();
  });
});

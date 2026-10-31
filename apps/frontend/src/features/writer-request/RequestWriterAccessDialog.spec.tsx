import { WRITER_REQUEST_NOTE_MAX_LENGTH } from '@smart-novel/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GraphqlRequestError } from '../../lib/graphql-fetcher';
import { showApiError, showSuccess } from '../../utils/notification';
import { RequestWriterAccessDialog } from './RequestWriterAccessDialog';

const requestWriterAccess = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
}));

vi.mock('../../generated/graphql', () => ({
  useRequestWriterAccessMutation: () => requestWriterAccess,
}));
vi.mock('../../utils/notification', () => ({
  showApiError: vi.fn(),
  showSuccess: vi.fn(),
}));

function renderDialog() {
  const onRequested = vi.fn();
  const onClose = vi.fn();

  render(
    <RequestWriterAccessDialog
      onRequested={onRequested}
      onClose={onClose}
    />,
  );

  return { onRequested, onClose, user: userEvent.setup() };
}

const noteLabel = 'Why do you want to write here?';

describe('RequestWriterAccessDialog', () => {
  beforeEach(() => {
    requestWriterAccess.mutate.mockReset();
    requestWriterAccess.isPending = false;
    vi.mocked(showApiError).mockReset();
    vi.mocked(showSuccess).mockReset();
  });

  it('disables sending while the note is empty or only whitespace', async () => {
    const { user } = renderDialog();
    const send = screen.getByRole('button', { name: 'Send request' });

    expect(send).toBeDisabled();

    await user.type(screen.getByLabelText(noteLabel), '   ');

    expect(send).toBeDisabled();
  });

  it('counts the characters against the limit and stops typing at it', async () => {
    const { user } = renderDialog();
    const textarea = screen.getByLabelText(noteLabel);

    await user.type(textarea, 'Fantasy');

    expect(textarea).toHaveAttribute(
      'maxLength',
      String(WRITER_REQUEST_NOTE_MAX_LENGTH),
    );
    expect(
      screen.getByText(`7 / ${WRITER_REQUEST_NOTE_MAX_LENGTH}`),
    ).toBeInTheDocument();
  });

  it('sends the trimmed note, confirms and reports it', async () => {
    const { user, onRequested } = renderDialog();
    requestWriterAccess.mutate.mockImplementation(
      (_variables, options) => options.onSuccess(),
    );
    await user.type(
      screen.getByLabelText(noteLabel),
      '  I serialize a fantasy web novel. ',
    );

    await user.click(
      screen.getByRole('button', { name: 'Send request' }),
    );

    expect(
      requestWriterAccess.mutate,
    ).toHaveBeenCalledExactlyOnceWith(
      { note: 'I serialize a fantasy web novel.' },
      expect.any(Object),
    );
    expect(showSuccess).toHaveBeenCalledOnce();
    expect(onRequested).toHaveBeenCalledOnce();
  });

  it('shows the refusal of the server inside the dialog and keeps it open', async () => {
    const { user, onRequested } = renderDialog();
    const message = 'You already have a pending writer request';
    requestWriterAccess.mutate.mockImplementation(
      (_variables, options) =>
        options.onError(
          new GraphqlRequestError(message, { code: 'BAD_REQUEST' }),
        ),
    );
    await user.type(screen.getByLabelText(noteLabel), 'Hello');

    await user.click(
      screen.getByRole('button', { name: 'Send request' }),
    );

    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(showApiError).not.toHaveBeenCalled();
    expect(onRequested).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'a server error',
      error: new GraphqlRequestError('boom', {
        code: 'INTERNAL_SERVER_ERROR',
      }),
    },
    {
      name: 'a network failure',
      error: new TypeError('Failed to fetch'),
    },
  ])('should use the generic error for $name', async ({ error }) => {
    const { user } = renderDialog();
    requestWriterAccess.mutate.mockImplementation(
      (_variables, options) => options.onError(error),
    );
    await user.type(screen.getByLabelText(noteLabel), 'Hello');

    await user.click(
      screen.getByRole('button', { name: 'Send request' }),
    );

    expect(showApiError).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('blocks the form while the request is in flight', () => {
    requestWriterAccess.isPending = true;
    renderDialog();

    expect(screen.getByLabelText(noteLabel)).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Send request' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Cancel' }),
    ).toBeDisabled();
  });

  it('closes from Cancel', async () => {
    const { user, onClose } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});

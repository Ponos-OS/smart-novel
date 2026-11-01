import {
  PEN_NAME_TAKEN,
  WRITER_NOTE_MAX_LENGTH,
  WRITER_PEN_NAME_MAX_LENGTH,
} from '@smart-novel/shared';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GraphqlRequestError } from '../../lib/graphql-fetcher';
import { showApiError, showSuccess } from '../../utils/notification';
import {
  PEN_NAME_TAKEN_HIGHLIGHT_MS,
  RequestWriterAccessDialog,
} from './RequestWriterAccessDialog';

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
const penNameLabel = 'Pen name';
const penName = 'Mina_Ardalan';

describe('RequestWriterAccessDialog', () => {
  beforeEach(() => {
    requestWriterAccess.mutate.mockReset();
    requestWriterAccess.isPending = false;
    vi.mocked(showApiError).mockReset();
    vi.mocked(showSuccess).mockReset();
  });

  it('disables sending while the note or the pen name is empty or only whitespace', async () => {
    const { user } = renderDialog();
    const send = screen.getByRole('button', { name: 'Send request' });

    expect(send).toBeDisabled();

    await user.type(screen.getByLabelText(noteLabel), '   ');
    await user.type(screen.getByLabelText(penNameLabel), penName);

    expect(send).toBeDisabled();

    await user.clear(screen.getByLabelText(noteLabel));
    await user.type(screen.getByLabelText(noteLabel), 'Hello');
    await user.clear(screen.getByLabelText(penNameLabel));
    await user.type(screen.getByLabelText(penNameLabel), '   ');

    expect(send).toBeDisabled();
  });

  it.each([
    { penName: 'ab', hint: 'at least 3 characters' },
    {
      penName: 'Mina2',
      hint: 'English letters, hyphens and underscores',
    },
    {
      penName: 'Mina Ardalan',
      hint: 'English letters, hyphens and underscores',
    },
    {
      penName: 'Мина',
      hint: 'English letters, hyphens and underscores',
    },
  ])(
    'explains what is wrong with the pen name "$penName" and does not send it',
    async ({ penName: invalid, hint }) => {
      const { user } = renderDialog();
      await user.type(screen.getByLabelText(noteLabel), 'Hello');

      await user.type(screen.getByLabelText(penNameLabel), invalid);

      expect(screen.getByLabelText(penNameLabel)).toHaveAttribute(
        'aria-invalid',
        'true',
      );
      expect(screen.getByText(new RegExp(hint))).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Send request' }),
      ).toBeDisabled();
    },
  );

  it('stops typing the pen name at the limit', () => {
    renderDialog();

    expect(screen.getByLabelText(penNameLabel)).toHaveAttribute(
      'maxLength',
      String(WRITER_PEN_NAME_MAX_LENGTH),
    );
  });

  describe('when the pen name is taken', () => {
    const takenError = () =>
      new GraphqlRequestError(
        'That pen name is already taken, please choose another one',
        { code: PEN_NAME_TAKEN },
      );

    async function sendTakenName() {
      const rendered = renderDialog();
      requestWriterAccess.mutate.mockImplementation(
        (_variables, options) => options.onError(takenError()),
      );
      await rendered.user.type(
        screen.getByLabelText(noteLabel),
        'I write fantasy.',
      );
      await rendered.user.type(
        screen.getByLabelText(penNameLabel),
        penName,
      );
      await rendered.user.click(
        screen.getByRole('button', { name: 'Send request' }),
      );

      return rendered;
    }

    it('turns the pen name red and tells the user, keeping the dialog and the note', async () => {
      const { onRequested } = await sendTakenName();

      expect(screen.getByLabelText(penNameLabel)).toHaveAttribute(
        'aria-invalid',
        'true',
      );
      expect(screen.getByLabelText(penNameLabel)).toHaveClass(
        'border-red-500',
      );
      expect(showApiError).toHaveBeenCalledWith(
        expect.stringContaining(`"${penName}" is already taken`),
      );
      expect(screen.getByLabelText(noteLabel)).toHaveValue(
        'I write fantasy.',
      );
      expect(onRequested).not.toHaveBeenCalled();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('turns it back after a few seconds', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      try {
        await sendTakenName();

        act(() => {
          vi.advanceTimersByTime(PEN_NAME_TAKEN_HIGHLIGHT_MS);
        });

        expect(screen.getByLabelText(penNameLabel)).not.toHaveClass(
          'border-red-500',
        );
        expect(screen.getByLabelText(penNameLabel)).toHaveAttribute(
          'aria-invalid',
          'false',
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it('turns it back as soon as the user edits the pen name', async () => {
      const { user } = await sendTakenName();

      await user.type(screen.getByLabelText(penNameLabel), '_Two');

      expect(screen.getByLabelText(penNameLabel)).not.toHaveClass(
        'border-red-500',
      );
    });
  });

  it('counts the characters against the limit and stops typing at it', async () => {
    const { user } = renderDialog();
    const textarea = screen.getByLabelText(noteLabel);

    await user.type(textarea, 'Fantasy');

    expect(textarea).toHaveAttribute(
      'maxLength',
      String(WRITER_NOTE_MAX_LENGTH),
    );
    expect(
      screen.getByText(`7 / ${WRITER_NOTE_MAX_LENGTH}`),
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
    await user.type(
      screen.getByLabelText(penNameLabel),
      `  ${penName} `,
    );

    await user.click(
      screen.getByRole('button', { name: 'Send request' }),
    );

    expect(
      requestWriterAccess.mutate,
    ).toHaveBeenCalledExactlyOnceWith(
      { note: 'I serialize a fantasy web novel.', penName },
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
    await user.type(screen.getByLabelText(penNameLabel), penName);

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
    await user.type(screen.getByLabelText(penNameLabel), penName);

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

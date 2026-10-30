import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GraphqlRequestError } from '../../lib/graphql-fetcher';
import { showApiError, showSuccess } from '../../utils/notification';
import { RequestCategoryDialog } from './RequestCategoryDialog';

const requestCategory = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
}));

vi.mock('../../generated/graphql', () => ({
  useRequestCategoryMutation: () => requestCategory,
}));
vi.mock('../../utils/notification', () => ({
  showApiError: vi.fn(),
  showSuccess: vi.fn(),
}));

function renderDialog(initialName = 'Slice of Life') {
  const onRequested = vi.fn();
  const onClose = vi.fn();

  render(
    <RequestCategoryDialog
      initialName={initialName}
      onRequested={onRequested}
      onClose={onClose}
    />,
  );

  return { onRequested, onClose, user: userEvent.setup() };
}

describe('RequestCategoryDialog', () => {
  beforeEach(() => {
    requestCategory.mutate.mockReset();
    requestCategory.isPending = false;
    vi.mocked(showApiError).mockReset();
    vi.mocked(showSuccess).mockReset();
  });

  it('prefills the typed name and explains that an admin has to approve it', () => {
    renderDialog('Slice of Life');

    expect(screen.getByLabelText('Category name')).toHaveValue(
      'Slice of Life',
    );
    expect(
      screen.getByText(
        /will be created and be available after an admin approves it\. Please come back later and add this category to your novel\./,
      ),
    ).toBeInTheDocument();
  });

  it('requests the trimmed name, confirms and reports it', async () => {
    const { user, onRequested } = renderDialog();
    requestCategory.mutate.mockImplementation((_variables, options) =>
      options.onSuccess({
        requestCategory: { name: 'slice of life' },
      }),
    );
    await user.clear(screen.getByLabelText('Category name'));
    await user.type(
      screen.getByLabelText('Category name'),
      '  Slice of Life ',
    );

    await user.click(
      screen.getByRole('button', { name: 'Request category' }),
    );

    expect(requestCategory.mutate).toHaveBeenCalledExactlyOnceWith(
      { name: 'Slice of Life' },
      expect.any(Object),
    );
    expect(showSuccess).toHaveBeenCalledWith(
      expect.stringContaining('"slice of life" was requested'),
    );
    expect(onRequested).toHaveBeenCalledOnce();
  });

  it('shows the refusal of the server inside the dialog and keeps it open', async () => {
    const { user, onRequested } = renderDialog('Fantasy');
    const message =
      'The category "fantasy" already exists or was already requested. Search for "fantasy" instead.';
    requestCategory.mutate.mockImplementation((_variables, options) =>
      options.onError(
        new GraphqlRequestError(message, { code: 'BAD_REQUEST' }),
      ),
    );

    await user.click(
      screen.getByRole('button', { name: 'Request category' }),
    );

    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(showApiError).not.toHaveBeenCalled();
    expect(onRequested).not.toHaveBeenCalled();
  });

  it('clears the refusal when the writer tries again', async () => {
    const { user } = renderDialog('Fantasy');
    requestCategory.mutate.mockImplementationOnce(
      (_variables, options) =>
        options.onError(
          new GraphqlRequestError('Already exists', {
            code: 'BAD_REQUEST',
          }),
        ),
    );
    await user.click(
      screen.getByRole('button', { name: 'Request category' }),
    );

    await user.click(
      screen.getByRole('button', { name: 'Request category' }),
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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
    requestCategory.mutate.mockImplementation((_variables, options) =>
      options.onError(error),
    );

    await user.click(
      screen.getByRole('button', { name: 'Request category' }),
    );

    expect(showApiError).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('cannot be submitted without a name', async () => {
    const { user } = renderDialog('Fantasy');

    await user.clear(screen.getByLabelText('Category name'));

    expect(
      screen.getByRole('button', { name: 'Request category' }),
    ).toBeDisabled();
  });

  it('closes with Cancel without requesting anything', async () => {
    const { user, onClose } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(requestCategory.mutate).not.toHaveBeenCalled();
  });
});

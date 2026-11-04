import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  type LicenseDraftInput,
  LicenseSourceType,
} from '../../generated/graphql';
import { GraphqlRequestError } from '../../lib/graphql-fetcher';
import { showApiError, showSuccess } from '../../utils/notification';
import { CreateLicenseDialog } from './CreateLicenseDialog';

const mutation = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
}));

vi.mock('../../utils/notification', () => ({
  showApiError: vi.fn(),
  showSuccess: vi.fn(),
}));
vi.mock('../../generated/graphql', async () => ({
  ...(await vi.importActual('../../generated/graphql')),
  useCreateLicenseMutation: () => mutation,
  useDefaultLicenseQuery: () => ({
    data: {
      defaultLicense: {
        id: '3f7b0c1e-6d52-4b8a-9a41-5c2e8d7f1a06',
        name: 'CC BY 4.0',
        sourceType: 'CANONICAL',
        canonicalId: 'CC-BY-4.0',
        text: 'Attribution 4.0 International',
      },
    },
    isLoading: false,
  }),
}));
vi.mock('../novel-license/LicenseField', () => ({
  LicenseField: ({
    onDraftChange,
  }: {
    onDraftChange: (draft: LicenseDraftInput | undefined) => void;
  }) => (
    <>
      <button
        onClick={() =>
          onDraftChange({
            title: 'Read it, do not copy it',
            text: 'You may read this novel. You may not copy it.',
            source: { type: LicenseSourceType.Custom },
          })
        }
      >
        Write a license
      </button>
      <button onClick={() => onDraftChange(undefined)}>
        Keep as it is
      </button>
    </>
  ),
}));

function renderDialog() {
  const onCreated = vi.fn();
  const onClose = vi.fn();

  render(
    <CreateLicenseDialog onCreated={onCreated} onClose={onClose} />,
  );

  return { onCreated, onClose, user: userEvent.setup() };
}

describe('CreateLicenseDialog', () => {
  beforeEach(() => {
    mutation.mutate.mockReset();
    vi.mocked(showApiError).mockReset();
    vi.mocked(showSuccess).mockReset();
  });

  it('should not allow creating while the license is unchanged', () => {
    renderDialog();

    expect(
      screen.getByRole('button', { name: 'Create license' }),
    ).toBeDisabled();
  });

  it('should create the license the admin wrote and tell the page', async () => {
    mutation.mutate.mockImplementation((_, { onSuccess }) =>
      onSuccess({
        createLicense: {
          id: 'b2d9c4aa-18f3-4f0e-9c57-3a6d1e8b7f42',
          name: 'Read it, do not copy it',
        },
      }),
    );
    const { user, onCreated } = renderDialog();

    await user.click(
      screen.getByRole('button', { name: 'Write a license' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Create license' }),
    );

    expect(mutation.mutate).toHaveBeenCalledWith(
      {
        input: {
          title: 'Read it, do not copy it',
          text: 'You may read this novel. You may not copy it.',
          source: { type: LicenseSourceType.Custom },
        },
      },
      expect.anything(),
    );
    expect(showSuccess).toHaveBeenCalledWith(
      '"Read it, do not copy it" was created.',
    );
    expect(onCreated).toHaveBeenCalledOnce();
  });

  it('should show the refusal of the server in the dialog', async () => {
    mutation.mutate.mockImplementation((_, { onError }) =>
      onError(
        new GraphqlRequestError(
          'This text is not the canonical license CC-BY-4.0, send it as FORKED or CUSTOM',
          { code: 'BAD_REQUEST' },
        ),
      ),
    );
    const { user, onCreated } = renderDialog();

    await user.click(
      screen.getByRole('button', { name: 'Write a license' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Create license' }),
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'is not the canonical license',
    );
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('should show a generic error for any other failure', async () => {
    mutation.mutate.mockImplementation((_, { onError }) =>
      onError(new Error('Network down')),
    );
    const { user } = renderDialog();

    await user.click(
      screen.getByRole('button', { name: 'Write a license' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Create license' }),
    );

    expect(showApiError).toHaveBeenCalledOnce();
  });
});

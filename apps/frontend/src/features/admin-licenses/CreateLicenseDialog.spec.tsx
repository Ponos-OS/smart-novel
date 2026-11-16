import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LicenseSourceType } from '../../generated/graphql';
import { GraphqlRequestError } from '../../lib/graphql-fetcher';
import { showApiError, showSuccess } from '../../utils/notification';
import { CreateLicenseDialog } from './CreateLicenseDialog';

const mutation = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
}));

const ccBySa = {
  id: '4d2e6a70-1c83-4f95-b0a2-7e9c3d5f8b14',
  canonicalID: 'CC-BY-SA-4.0',
  name: 'CC BY-SA 4.0',
  officialURL:
    'https://creativecommons.org/licenses/by-sa/4.0/legalcode',
  text: 'Attribution-ShareAlike 4.0 International',
};

vi.mock('../../utils/notification', () => ({
  showApiError: vi.fn(),
  showSuccess: vi.fn(),
}));
vi.mock('../../generated/graphql', async () => ({
  ...(await vi.importActual('../../generated/graphql')),
  useCreateLicenseMutation: () => mutation,
  useCanonicalLicensesQuery: () => ({
    data: {
      licenses: {
        edges: [
          {
            node: {
              id: '3f7b0c1e-6d52-4b8a-9a41-5c2e8d7f1a06',
              canonicalID: 'CC-BY-4.0',
              name: 'CC BY 4.0',
            },
          },
          { node: ccBySa },
        ],
      },
    },
  }),
  useCanonicalLicenseQuery: (
    { canonicalID }: { canonicalID: string },
    { enabled }: { enabled: boolean },
  ) => ({
    data:
      enabled && canonicalID === ccBySa.canonicalID
        ? { licenses: { edges: [{ node: ccBySa }] } }
        : undefined,
  }),
}));

function renderDialog() {
  const onCreated = vi.fn();
  const onClose = vi.fn();

  render(
    <CreateLicenseDialog onCreated={onCreated} onClose={onClose} />,
  );

  return { onCreated, onClose, user: userEvent.setup() };
}

const submit = () =>
  screen.getByRole('button', { name: 'Create license' });

describe('CreateLicenseDialog', () => {
  beforeEach(() => {
    mutation.mutate.mockReset();
    vi.mocked(showApiError).mockReset();
    vi.mocked(showSuccess).mockReset();
  });

  it('should start from writing a license, not from keeping one', () => {
    renderDialog();

    expect(
      screen
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Write your own', 'CC BY 4.0', 'CC BY-SA 4.0']);
    expect(screen.getByLabelText('Start from')).toHaveValue('');
    expect(submit()).toBeDisabled();
  });

  it('should create a license the admin wrote, once it has a name and a text', async () => {
    mutation.mutate.mockImplementation((_, { onSuccess }) =>
      onSuccess({
        createLicense: {
          id: 'b2d9c4aa-18f3-4f0e-9c57-3a6d1e8b7f42',
          name: 'Read it, do not copy it',
        },
      }),
    );
    const { user, onCreated } = renderDialog();

    await user.type(
      screen.getByLabelText('Name'),
      ' Read it, do not copy it ',
    );
    expect(submit()).toBeDisabled();
    await user.type(
      screen.getByLabelText('License text'),
      'You may read this novel.',
    );
    await user.click(submit());

    expect(mutation.mutate).toHaveBeenCalledWith(
      {
        input: {
          name: 'Read it, do not copy it',
          text: 'You may read this novel.',
          sourceType: LicenseSourceType.Custom,
        },
      },
      expect.anything(),
    );
    expect(showSuccess).toHaveBeenCalledWith(
      '"Read it, do not copy it" was created.',
    );
    expect(onCreated).toHaveBeenCalledOnce();
  });

  it('should add a canonical license as it is, without asking for a name', async () => {
    const { user } = renderDialog();

    await user.selectOptions(
      screen.getByLabelText('Start from'),
      'CC BY-SA 4.0',
    );
    await user.click(submit());

    expect(screen.getByLabelText('License text')).toHaveValue(
      ccBySa.text,
    );
    expect(
      screen.getByRole('link', { name: /official license text/ }),
    ).toHaveAttribute('href', ccBySa.officialURL);
    expect(
      screen.queryByLabelText('Name of your modified license'),
    ).not.toBeInTheDocument();
    expect(mutation.mutate).toHaveBeenCalledWith(
      {
        input: {
          name: 'CC BY-SA 4.0',
          text: ccBySa.text,
          sourceType: LicenseSourceType.Canonical,
          canonicalID: ccBySa.canonicalID,
        },
      },
      expect.anything(),
    );
  });

  it('should ask for a name, and create a fork, once the text of a canonical license changes', async () => {
    const { user } = renderDialog();
    await user.selectOptions(
      screen.getByLabelText('Start from'),
      'CC BY-SA 4.0',
    );

    fireEvent.change(screen.getByLabelText('License text'), {
      target: { value: `${ccBySa.text} Small authors may sell it.` },
    });

    expect(submit()).toBeDisabled();
    await user.type(
      screen.getByLabelText('Name of your modified license'),
      'SA, except small authors',
    );
    await user.click(submit());
    expect(mutation.mutate).toHaveBeenCalledWith(
      {
        input: {
          name: 'SA, except small authors',
          text: `${ccBySa.text} Small authors may sell it.`,
          sourceType: LicenseSourceType.Forked,
          canonicalID: ccBySa.canonicalID,
        },
      },
      expect.anything(),
    );
  });

  it('should clear what was typed when another starting point is picked', async () => {
    const { user } = renderDialog();
    await user.type(screen.getByLabelText('Name'), 'Mine');
    await user.type(screen.getByLabelText('License text'), 'Mine.');

    await user.selectOptions(
      screen.getByLabelText('Start from'),
      'CC BY-SA 4.0',
    );
    await user.selectOptions(
      screen.getByLabelText('Start from'),
      'Write your own',
    );

    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('License text')).toHaveValue('');
  });

  it('should show the refusal of the server in the dialog', async () => {
    mutation.mutate.mockImplementation((_, { onError }) =>
      onError(
        new GraphqlRequestError(
          'This text is not the canonical license CC-BY-SA-4.0, send it as FORKED or CUSTOM',
          { code: 'BAD_REQUEST' },
        ),
      ),
    );
    const { user, onCreated } = renderDialog();
    await user.selectOptions(
      screen.getByLabelText('Start from'),
      'CC BY-SA 4.0',
    );

    await user.click(submit());

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
    await user.selectOptions(
      screen.getByLabelText('Start from'),
      'CC BY-SA 4.0',
    );

    await user.click(submit());

    expect(showApiError).toHaveBeenCalledOnce();
  });
});

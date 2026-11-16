import { fireEvent, render, screen } from '@testing-library/react';

import { LicenseSourceType } from '../../generated/graphql';
import { type LicenseSummary } from './license-notice';
import { LicenseField } from './LicenseField';

const storedLicenses = vi.hoisted(() => ({
  SHARED: [
    {
      id: '3f7b0c1e-6d52-4b8a-9a41-5c2e8d7f1a06',
      name: 'CC BY 4.0',
      sourceType: 'CANONICAL',
      canonicalID: 'CC-BY-4.0',
      officialURL: null,
      text: 'Attribution 4.0 International',
    },
    {
      id: 'e7a1c9d2-5b34-4f68-8c01-6d2f4a9b3e17',
      name: 'Read it, do not copy it',
      sourceType: 'CUSTOM',
      canonicalID: null,
      officialURL: null,
      text: 'You may read this novel. You may not copy it.',
    },
  ],
  PERSONAL: [
    {
      id: 'c1d4a7f2-6e58-4b39-8a64-2f0e9b7d3c55',
      name: 'Only for my fans',
      sourceType: 'CUSTOM',
      canonicalID: null,
      officialURL: null,
      text: 'Fans may read this novel for free.',
    },
  ],
}));

vi.mock('../../generated/graphql', async () => ({
  ...(await vi.importActual('../../generated/graphql')),
  useSelectableLicensesQuery: ({
    scope,
  }: {
    scope: 'SHARED' | 'PERSONAL';
  }) => ({
    data: {
      licenses: {
        edges: storedLicenses[scope].map((node) => ({ node })),
      },
    },
  }),
}));

describe(LicenseField.name, () => {
  const canonical = {
    id: '3f7b0c1e-6d52-4b8a-9a41-5c2e8d7f1a06',
    name: 'CC BY 4.0',
    sourceType: LicenseSourceType.Canonical,
    canonicalID: 'CC-BY-4.0',
    text: 'Attribution 4.0 International',
  };
  const custom = {
    ...canonical,
    id: 'b2d9c4aa-18f3-4f0e-9c57-3a6d1e8b7f42',
    name: 'Read it, do not copy it',
    sourceType: LicenseSourceType.Custom,
    canonicalID: null,
    text: 'You may read this novel. You may not copy it.',
  };
  const [, sharedCustom] = storedLicenses.SHARED;
  const [personal] = storedLicenses.PERSONAL;

  function renderField(
    license: LicenseSummary = canonical,
    extra: { onDraftWithAssistant?: () => void } = {},
  ) {
    const onDraftChange = vi.fn();
    const onLicenseIdChange = vi.fn();

    render(
      <LicenseField
        license={license}
        onDraftChange={onDraftChange}
        onLicenseIdChange={onLicenseIdChange}
        {...extra}
      />,
    );

    return { onDraftChange, onLicenseIdChange };
  }

  it('keeps the license in use, with no draft and no title input, until something changes', () => {
    // Act
    const { onDraftChange, onLicenseIdChange } = renderField();

    // Assert
    expect(
      screen.getByText('CC BY 4.0', { selector: 'strong' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('License text')).toHaveValue(
      canonical.text,
    );
    expect(
      screen.queryByLabelText('Name of your modified license'),
    ).not.toBeInTheDocument();
    expect(onDraftChange).toHaveBeenLastCalledWith(undefined);
    expect(onLicenseIdChange).toHaveBeenLastCalledWith(undefined);
  });

  it.each([
    [canonical, { sourceType: 'FORKED', canonicalID: 'CC-BY-4.0' }],
    [custom, { sourceType: 'CUSTOM', canonicalID: undefined }],
  ])(
    'builds a draft with the right source when the text of %o is edited',
    (license, source) => {
      // Arrange
      const { onDraftChange } = renderField(license);

      // Act
      fireEvent.change(screen.getByLabelText('License text'), {
        target: { value: `${license.text} No resale.` },
      });
      fireEvent.change(
        screen.getByLabelText('Name of your modified license'),
        { target: { value: ' My terms ' } },
      );

      // Assert
      expect(onDraftChange).toHaveBeenLastCalledWith({
        name: 'My terms',
        text: `${license.text} No resale.`,
        ...source,
      });
    },
  );

  it('drops the draft when the text is reset to the license', () => {
    // Arrange
    const { onDraftChange } = renderField();
    fireEvent.change(screen.getByLabelText('License text'), {
      target: { value: 'Something else' },
    });

    // Act
    fireEvent.click(
      screen.getByRole('button', { name: 'Reset to CC BY 4.0' }),
    );

    // Assert
    expect(onDraftChange).toHaveBeenLastCalledWith(undefined);
    expect(screen.getByLabelText('License text')).toHaveValue(
      canonical.text,
    );
  });

  it('offers the assistant only when an entry point is given', () => {
    // Arrange
    const onDraftWithAssistant = vi.fn();
    const { unmount } = render(
      <LicenseField
        license={canonical}
        onDraftChange={vi.fn()}
        onLicenseIdChange={vi.fn()}
      />,
    );
    const hiddenWithout = screen.queryByRole('button', {
      name: 'Draft with assistant',
    });
    unmount();

    // Act
    renderField(canonical, { onDraftWithAssistant });
    fireEvent.click(
      screen.getByRole('button', { name: 'Draft with assistant' }),
    );

    // Assert
    expect(hiddenWithout).not.toBeInTheDocument();
    expect(onDraftWithAssistant).toHaveBeenCalledOnce();
  });

  describe('stored licenses', () => {
    it('offers the shared and the own licenses, but not the one in use', () => {
      renderField();

      expect(
        screen
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['Keep CC BY 4.0', sharedCustom.name, personal.name]);
      expect(
        screen.getByRole('group', { name: 'Shared licenses' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('group', { name: 'Your licenses' }),
      ).toBeInTheDocument();
    });

    it('hands over the id of the picked license, and no draft, while its text is left alone', () => {
      const { onDraftChange, onLicenseIdChange } = renderField();

      fireEvent.change(screen.getByLabelText('Start from'), {
        target: { value: `stored:${personal.id}` },
      });

      expect(screen.getByLabelText('License text')).toHaveValue(
        personal.text,
      );
      expect(onLicenseIdChange).toHaveBeenLastCalledWith(personal.id);
      expect(onDraftChange).toHaveBeenLastCalledWith(undefined);
    });

    it('drops the id and builds a draft once the text of the picked license is edited', () => {
      const { onDraftChange, onLicenseIdChange } = renderField();
      fireEvent.change(screen.getByLabelText('Start from'), {
        target: { value: `stored:${sharedCustom.id}` },
      });

      fireEvent.change(screen.getByLabelText('License text'), {
        target: { value: `${sharedCustom.text} Fans may share it.` },
      });
      fireEvent.change(
        screen.getByLabelText('Name of your modified license'),
        { target: { value: 'Fans may share it' } },
      );

      expect(onLicenseIdChange).toHaveBeenLastCalledWith(undefined);
      expect(onDraftChange).toHaveBeenLastCalledWith({
        name: 'Fans may share it',
        text: `${sharedCustom.text} Fans may share it.`,
        sourceType: 'CUSTOM',
        canonicalID: undefined,
      });
    });

    it('hands over no id when the license in use is kept again', () => {
      const { onLicenseIdChange } = renderField();
      fireEvent.change(screen.getByLabelText('Start from'), {
        target: { value: `stored:${sharedCustom.id}` },
      });

      fireEvent.change(screen.getByLabelText('Start from'), {
        target: { value: '' },
      });

      expect(onLicenseIdChange).toHaveBeenLastCalledWith(undefined);
      expect(screen.getByLabelText('License text')).toHaveValue(
        canonical.text,
      );
    });
  });
});

import { fireEvent, render, screen } from '@testing-library/react';

import { LicenseSourceType } from '../../generated/graphql';
import { LicenseField } from './LicenseField';

const ccByNc = {
  id: 'CC-BY-NC-4.0',
  name: 'Creative Commons Attribution-NonCommercial 4.0 International',
  shortName: 'CC BY-NC 4.0',
  officialUrl:
    'https://creativecommons.org/licenses/by-nc/4.0/legalcode',
  body: 'Attribution-NonCommercial 4.0 International',
};

vi.mock('../../generated/graphql', async () => ({
  ...(await vi.importActual('../../generated/graphql')),
  useCanonicalLicensesQuery: () => ({
    data: {
      canonicalLicenses: [
        { id: 'CC-BY-4.0', shortName: 'CC BY 4.0' },
        { id: 'CC-BY-NC-4.0', shortName: 'CC BY-NC 4.0' },
        { id: 'CC-BY-SA-4.0', shortName: 'CC BY-SA 4.0' },
      ],
    },
  }),
  useCanonicalLicenseQuery: (
    { id }: { id: string },
    { enabled }: { enabled: boolean },
  ) => ({
    // CC-BY-SA-4.0 never loads, to see what the form does meanwhile.
    data:
      enabled && id === 'CC-BY-NC-4.0'
        ? { canonicalLicense: ccByNc }
        : undefined,
  }),
}));

describe(LicenseField.name, () => {
  const canonical = {
    id: '3f7b0c1e-6d52-4b8a-9a41-5c2e8d7f1a06',
    name: 'CC BY 4.0',
    sourceType: LicenseSourceType.Canonical,
    canonicalId: 'CC-BY-4.0',
    text: 'Attribution 4.0 International',
  };
  const custom = {
    ...canonical,
    id: 'b2d9c4aa-18f3-4f0e-9c57-3a6d1e8b7f42',
    name: 'Read it, do not copy it',
    sourceType: LicenseSourceType.Custom,
    canonicalId: null,
    text: 'You may read this novel. You may not copy it.',
  };

  it('keeps the license in use, with no draft and no title input, until something changes', () => {
    // Arrange
    const onDraftChange = vi.fn();

    // Act
    render(
      <LicenseField
        license={canonical}
        onDraftChange={onDraftChange}
      />,
    );

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
  });

  it.each([
    [canonical, { type: 'FORKED', canonicalId: 'CC-BY-4.0' }],
    [custom, { type: 'CUSTOM', canonicalId: undefined }],
  ])(
    'builds a draft with the right source when the text of %o is edited',
    (license, source) => {
      // Arrange
      const onDraftChange = vi.fn();
      render(
        <LicenseField
          license={license}
          onDraftChange={onDraftChange}
        />,
      );

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
        title: 'My terms',
        text: `${license.text} No resale.`,
        source,
      });
    },
  );

  it('drops the draft when the text is reset to the license', () => {
    // Arrange
    const onDraftChange = vi.fn();
    render(
      <LicenseField
        license={canonical}
        onDraftChange={onDraftChange}
      />,
    );
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

  it('offers the canonical licenses and saves the picked one as canonical, under the name of the registry', () => {
    // Arrange
    const onDraftChange = vi.fn();
    render(
      <LicenseField license={custom} onDraftChange={onDraftChange} />,
    );

    // Act
    fireEvent.change(screen.getByLabelText('Start from'), {
      target: { value: 'CC-BY-NC-4.0' },
    });

    // Assert
    expect(
      screen
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual([
      'Keep Read it, do not copy it',
      'CC BY 4.0',
      'CC BY-NC 4.0',
      'CC BY-SA 4.0',
    ]);
    expect(screen.getByLabelText('License text')).toHaveValue(
      ccByNc.body,
    );
    expect(
      screen.getByRole('link', {
        name: /Read the official license text/,
      }),
    ).toHaveAttribute('href', ccByNc.officialUrl);
    expect(onDraftChange).toHaveBeenLastCalledWith({
      title: 'CC BY-NC 4.0',
      text: ccByNc.body,
      source: { type: 'CANONICAL', canonicalId: 'CC-BY-NC-4.0' },
    });
  });

  it('forks the picked license when its text is edited', () => {
    // Arrange
    const onDraftChange = vi.fn();
    render(
      <LicenseField license={custom} onDraftChange={onDraftChange} />,
    );
    fireEvent.change(screen.getByLabelText('Start from'), {
      target: { value: 'CC-BY-NC-4.0' },
    });

    // Act
    fireEvent.change(screen.getByLabelText('License text'), {
      target: { value: `${ccByNc.body} Small authors may sell it.` },
    });
    fireEvent.change(
      screen.getByLabelText('Name of your modified license'),
      { target: { value: 'NC, except small authors' } },
    );

    // Assert
    expect(onDraftChange).toHaveBeenLastCalledWith({
      title: 'NC, except small authors',
      text: `${ccByNc.body} Small authors may sell it.`,
      source: { type: 'FORKED', canonicalId: 'CC-BY-NC-4.0' },
    });
  });

  it('goes back to the license in use, with no draft, when the pick is withdrawn', () => {
    // Arrange
    const onDraftChange = vi.fn();
    render(
      <LicenseField license={custom} onDraftChange={onDraftChange} />,
    );
    fireEvent.change(screen.getByLabelText('Start from'), {
      target: { value: 'CC-BY-NC-4.0' },
    });

    // Act
    fireEvent.change(screen.getByLabelText('Start from'), {
      target: { value: '' },
    });

    // Assert
    expect(screen.getByLabelText('License text')).toHaveValue(
      custom.text,
    );
    expect(onDraftChange).toHaveBeenLastCalledWith(undefined);
  });

  it('keeps the form from saving while the picked license is still loading', () => {
    // Arrange
    const onDraftChange = vi.fn();
    render(
      <LicenseField license={custom} onDraftChange={onDraftChange} />,
    );

    // Act
    fireEvent.change(screen.getByLabelText('Start from'), {
      target: { value: 'CC-BY-SA-4.0' },
    });

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading the license...',
    );
    expect(onDraftChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: '' }),
    );
  });

  it('offers the assistant only when an entry point is given', () => {
    // Arrange
    const onDraftWithAssistant = vi.fn();
    const { rerender } = render(
      <LicenseField license={canonical} onDraftChange={vi.fn()} />,
    );

    // Act
    const hiddenWithout = screen.queryByRole('button', {
      name: 'Draft with assistant',
    });
    rerender(
      <LicenseField
        license={canonical}
        onDraftChange={vi.fn()}
        onDraftWithAssistant={onDraftWithAssistant}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Draft with assistant' }),
    );

    // Assert
    expect(hiddenWithout).not.toBeInTheDocument();
    expect(onDraftWithAssistant).toHaveBeenCalledOnce();
  });
});

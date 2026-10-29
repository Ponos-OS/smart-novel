import { fireEvent, render, screen } from '@testing-library/react';

import { LicenseSourceType } from '../../generated/graphql';
import { LicenseField } from './LicenseField';

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

  it('shows the license without a draft and without the title input', () => {
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
    expect(screen.getByText('CC BY 4.0')).toBeInTheDocument();
    expect(screen.getByLabelText('License text')).toHaveValue(
      canonical.text,
    );
    expect(
      screen.queryByLabelText('Name of your modified license'),
    ).not.toBeInTheDocument();
    expect(onDraftChange).not.toHaveBeenCalled();
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

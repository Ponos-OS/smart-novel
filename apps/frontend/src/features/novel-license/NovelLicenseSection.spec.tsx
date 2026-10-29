import { render, screen } from '@testing-library/react';

import { LicenseSourceType } from '../../generated/graphql';
import { NovelLicenseSection } from './NovelLicenseSection';

describe(NovelLicenseSection.name, () => {
  const license = {
    id: '3f7b0c1e-6d52-4b8a-9a41-5c2e8d7f1a06',
    name: 'CC BY 4.0',
    sourceType: LicenseSourceType.Canonical,
    canonicalId: 'CC-BY-4.0',
    text: 'Attribution 4.0 International',
  };

  it('shows the license name, its notice and the disclaimer', () => {
    // Act
    render(<NovelLicenseSection license={license} />);

    // Assert
    expect(
      screen.getByRole('heading', { name: 'License: CC BY 4.0' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Canonical license CC-BY-4.0'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/it is not legal advice/),
    ).toBeInTheDocument();
  });

  it('keeps the full text collapsed until the summary is opened', () => {
    // Act
    render(<NovelLicenseSection license={license} />);

    // Assert
    const details = screen
      .getByText('Read the full license text')
      .closest('details');
    expect(details).not.toHaveAttribute('open');
    expect(details).toHaveTextContent(license.text);
  });

  it('links the official text of a canonical license, marked as an external link', () => {
    // Act
    render(
      <NovelLicenseSection
        license={{
          ...license,
          officialUrl:
            'https://creativecommons.org/licenses/by/4.0/legalcode',
        }}
      />,
    );

    // Assert
    const link = screen.getByRole('link', {
      name: 'Read the official license text (opens in a new tab)',
    });
    expect(link).toHaveAttribute(
      'href',
      'https://creativecommons.org/licenses/by/4.0/legalcode',
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('shows no link when the license has none', () => {
    // Act
    render(<NovelLicenseSection license={license} />);

    // Assert
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

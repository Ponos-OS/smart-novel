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
});

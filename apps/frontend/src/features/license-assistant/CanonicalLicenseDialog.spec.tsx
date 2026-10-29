import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GraphqlRequestError } from '../../lib/graphql-fetcher';
import { CanonicalLicenseDialog } from './CanonicalLicenseDialog';

const query = vi.hoisted(() => ({ value: {} as unknown }));

vi.mock('../../generated/graphql', async () => ({
  ...(await vi.importActual('../../generated/graphql')),
  useCanonicalLicenseQuery: () => query.value,
}));

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => (
    <div>{children}</div>
  ),
}));

const license = {
  id: 'CC-BY-NC-4.0',
  name: 'Creative Commons Attribution-NonCommercial 4.0 International',
  shortName: 'CC BY-NC 4.0',
  version: '4.0',
  category: 'creative_commons',
  officialUrl:
    'https://creativecommons.org/licenses/by-nc/4.0/legalcode',
  summary:
    'Share and adapt for non-commercial purposes, with credit.',
  permissions: ['share', 'adapt'],
  limitations: ['no commercial use'],
  conditions: ['attribution'],
  body: 'Attribution-NonCommercial 4.0 International, the full legal text.',
};

describe(CanonicalLicenseDialog.name, () => {
  it('shows the license: what it permits, limits and requires, its link and its full text', () => {
    // Arrange
    query.value = { data: { canonicalLicense: license } };

    // Act
    render(
      <CanonicalLicenseDialog
        licenseId="CC-BY-NC-4.0"
        onClose={vi.fn()}
      />,
    );

    // Assert
    expect(
      screen.getByRole('dialog', { name: license.name }),
    ).toBeInTheDocument();
    expect(screen.getByText(license.summary)).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Permissions' }),
    ).toHaveTextContent('adapt');
    expect(
      screen.getByRole('region', { name: 'Limitations' }),
    ).toHaveTextContent('no commercial use');
    expect(
      screen.getByRole('region', { name: 'Conditions' }),
    ).toHaveTextContent('attribution');
    expect(
      screen.getByRole('link', { name: /official license text/ }),
    ).toHaveAttribute('href', license.officialUrl);
    expect(
      screen.getByRole('region', { name: 'Full text' }),
    ).toHaveTextContent('the full legal text');
  });

  it('says it is loading, under the id of the license, until the license arrives', () => {
    // Arrange
    query.value = { data: undefined, error: null };

    // Act
    render(
      <CanonicalLicenseDialog
        licenseId="CC-BY-NC-4.0"
        onClose={vi.fn()}
      />,
    );

    // Assert
    expect(
      screen.getByRole('dialog', { name: 'CC-BY-NC-4.0' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading the license...',
    );
  });

  it('says why it cannot show the license', () => {
    // Arrange
    query.value = {
      data: undefined,
      error: new GraphqlRequestError('gone', {
        code: 'CANONICAL_LICENSE_RETIRED',
      }),
    };

    // Act
    render(
      <CanonicalLicenseDialog
        licenseId="CC-BY-NC-4.0"
        onClose={vi.fn()}
      />,
    );

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'no longer offered for new drafts',
    );
  });

  it('closes from its Close button', async () => {
    // Arrange
    const user = userEvent.setup();
    const onClose = vi.fn();
    query.value = { data: { canonicalLicense: license } };
    render(
      <CanonicalLicenseDialog
        licenseId="CC-BY-NC-4.0"
        onClose={onClose}
      />,
    );

    // Act
    await user.click(screen.getByRole('button', { name: 'Close' }));

    // Assert
    expect(onClose).toHaveBeenCalledOnce();
  });
});

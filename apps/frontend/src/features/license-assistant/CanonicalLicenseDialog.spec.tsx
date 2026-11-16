import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GraphqlRequestError } from '../../lib/graphql-fetcher';
import { CanonicalLicenseDialog } from './CanonicalLicenseDialog';

const query = vi.hoisted(() => ({ value: {} as unknown }));

vi.mock('../../generated/graphql', async () => ({
  ...(await vi.importActual('../../generated/graphql')),
  useCanonicalLicenseQuery: () => query.value,
}));

const license = {
  id: '9b1d3c52-8b0e-4a39-9c4d-2f6a7e1b5d08',
  canonicalID: 'CC-BY-NC-4.0',
  name: 'CC BY-NC 4.0',
  version: '4.0',
  officialURL:
    'https://creativecommons.org/licenses/by-nc/4.0/legalcode',
  text: 'Attribution-NonCommercial 4.0 International, the full legal text.',
};
const found = { data: { licenses: { edges: [{ node: license }] } } };

describe(CanonicalLicenseDialog.name, () => {
  it('shows the license: its name and version, its link and its full text', () => {
    // Arrange
    query.value = found;

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
    expect(
      screen.getByText(/CC BY-NC 4.0, version 4.0/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /official license text/ }),
    ).toHaveAttribute('href', license.officialURL);
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
    query.value = found;
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

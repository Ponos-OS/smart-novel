import { render, screen } from '@testing-library/react';

import { LicenseSourceType } from '../../generated/graphql';
import { DraftSourceBadge } from './DraftSourceBadge';

const hooks = vi.hoisted(() => ({ list: undefined as unknown }));

vi.mock('../../generated/graphql', async () => ({
  ...(await vi.importActual('../../generated/graphql')),
  useCanonicalLicensesQuery: () => ({ data: hooks.list }),
}));

const registry = {
  canonicalLicenses: [
    {
      id: 'CC-BY-NC-4.0',
      shortName: 'CC BY-NC 4.0',
      officialUrl:
        'https://creativecommons.org/licenses/by-nc/4.0/legalcode',
    },
  ],
};

describe(DraftSourceBadge.name, () => {
  beforeEach(() => {
    hooks.list = registry;
  });

  it('names the canonical license by its short name and links its official text', () => {
    // Act
    render(
      <DraftSourceBadge
        source={{
          type: LicenseSourceType.Canonical,
          canonicalId: 'CC-BY-NC-4.0',
        }}
      />,
    );

    // Assert
    expect(
      screen.getByText('Canonical license: CC BY-NC 4.0'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: /Read the official license text/,
      }),
    ).toHaveAttribute(
      'href',
      'https://creativecommons.org/licenses/by-nc/4.0/legalcode',
    );
  });

  it('warns that a modified license is not the canonical one, naming its base', () => {
    // Act
    render(
      <DraftSourceBadge
        source={{
          type: LicenseSourceType.Forked,
          canonicalId: 'CC-BY-NC-4.0',
        }}
      />,
    );

    // Assert
    expect(
      screen.getByText(
        'Modified from CC BY-NC 4.0 — not the same as the canonical license',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link')).toBeInTheDocument();
  });

  it('tells the author to have a custom license reviewed, with no link', () => {
    // Act
    render(
      <DraftSourceBadge
        source={{ type: LicenseSourceType.Custom, canonicalId: null }}
      />,
    );

    // Assert
    expect(
      screen.getByText('Custom license — review with a lawyer.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('falls back to the license id while the registry is not loaded', () => {
    // Arrange
    hooks.list = undefined;

    // Act
    render(
      <DraftSourceBadge
        source={{
          type: LicenseSourceType.Forked,
          canonicalId: 'CC-BY-NC-4.0',
        }}
      />,
    );

    // Assert
    expect(
      screen.getByText(/Modified from CC-BY-NC-4.0/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

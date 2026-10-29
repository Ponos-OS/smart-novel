import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RecommendationChips } from './RecommendationChips';

const hooks = vi.hoisted(() => ({ list: undefined as unknown }));

vi.mock('../../generated/graphql', async () => ({
  ...(await vi.importActual('../../generated/graphql')),
  useCanonicalLicensesQuery: () => ({ data: hooks.list }),
}));

describe(RecommendationChips.name, () => {
  beforeEach(() => {
    hooks.list = {
      canonicalLicenses: [
        { id: 'CC-BY-NC-4.0', shortName: 'CC BY-NC 4.0' },
        { id: 'CC-BY-NC-SA-4.0', shortName: 'CC BY-NC-SA 4.0' },
      ],
    };
  });

  it('shows nothing when the assistant suggests nothing', () => {
    // Act
    const { container } = render(
      <RecommendationChips
        recommendations={[]}
        onPrefill={vi.fn()}
        onViewLicense={vi.fn()}
      />,
    );

    // Assert
    expect(container).toBeEmptyDOMElement();
  });

  it('offers, for every suggested license, to use it and to read it, by its short name', () => {
    // Act
    render(
      <RecommendationChips
        recommendations={['CC-BY-NC-4.0', 'CC-BY-NC-SA-4.0']}
        onPrefill={vi.fn()}
        onViewLicense={vi.fn()}
      />,
    );

    // Assert
    expect(
      screen
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual([
      'Use CC BY-NC 4.0',
      'Read CC BY-NC 4.0',
      'Use CC BY-NC-SA 4.0',
      'Read CC BY-NC-SA 4.0',
    ]);
  });

  it('puts a sentence about the license into the composer instead of sending it', async () => {
    // Arrange
    const user = userEvent.setup();
    const onPrefill = vi.fn();
    render(
      <RecommendationChips
        recommendations={['CC-BY-NC-4.0']}
        onPrefill={onPrefill}
        onViewLicense={vi.fn()}
      />,
    );

    // Act
    await user.click(
      screen.getByRole('button', { name: 'Use CC BY-NC 4.0' }),
    );

    // Assert
    expect(onPrefill).toHaveBeenCalledExactlyOnceWith(
      'I would like to use CC BY-NC 4.0 for my novel.',
    );
  });

  it('opens the license to read it by its id', async () => {
    // Arrange
    const user = userEvent.setup();
    const onViewLicense = vi.fn();
    render(
      <RecommendationChips
        recommendations={['CC-BY-NC-4.0']}
        onPrefill={vi.fn()}
        onViewLicense={onViewLicense}
      />,
    );

    // Act
    await user.click(
      screen.getByRole('button', { name: 'Read CC BY-NC 4.0' }),
    );

    // Assert
    expect(onViewLicense).toHaveBeenCalledExactlyOnceWith(
      'CC-BY-NC-4.0',
    );
  });

  it('names a license by its id until the registry is loaded', () => {
    // Arrange
    hooks.list = undefined;

    // Act
    render(
      <RecommendationChips
        recommendations={['CC-BY-NC-4.0']}
        onPrefill={vi.fn()}
        onViewLicense={vi.fn()}
      />,
    );

    // Assert
    expect(
      screen.getByRole('button', { name: 'Use CC-BY-NC-4.0' }),
    ).toBeInTheDocument();
  });
});

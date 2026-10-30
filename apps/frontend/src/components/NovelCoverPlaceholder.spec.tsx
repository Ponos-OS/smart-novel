import { render, screen } from '@testing-library/react';

import {
  getCoverGradient,
  NovelCoverPlaceholder,
} from './NovelCoverPlaceholder';

describe('NovelCoverPlaceholder', () => {
  it('shows the novel title', () => {
    render(<NovelCoverPlaceholder title="The Lantern Keeper" />);

    expect(screen.getByRole('img')).toHaveAccessibleName(
      'The Lantern Keeper',
    );
    expect(screen.getByText('The Lantern Keeper')).toBeVisible();
  });

  it('derives the same gradient for the same title', () => {
    const first = getCoverGradient('The Lantern Keeper');
    const second = getCoverGradient('The Lantern Keeper');

    expect(first).toBe(second);
    expect(first).toStartWith('linear-gradient(135deg, hsl(');
  });

  it('derives a different gradient for a different title', () => {
    const lantern = getCoverGradient('The Lantern Keeper');
    const journey = getCoverGradient('The Journey Begins');

    expect(lantern).not.toBe(journey);
  });
});

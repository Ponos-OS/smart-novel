import { render, screen } from '@testing-library/react';

import { DraftBody } from './DraftBody';

describe('DraftBody headings', () => {
  it('should move the headings of the text below the headings of the page', () => {
    // Arrange
    const text = '# Title\n\n## Section 3\n\n###### Deep\n\nBody.';

    // Act
    render(<DraftBody text={text} />);

    // Assert
    expect(
      screen.queryByRole('heading', { level: 1 }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 2 }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 4, name: 'Title' }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { level: 5, name: 'Section 3' }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { level: 6, name: 'Deep' }),
    ).toBeVisible();
  });
});

import { render, screen } from '@testing-library/react';

import { DraftBody } from './DraftBody';

describe(DraftBody.name, () => {
  it('renders the text of the draft as it is, without interpreting it', () => {
    // Arrange
    const text = '# CC BY 4.0\n\n**without** resale';

    // Act
    render(<DraftBody text={text} />);

    // Assert
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByText(/CC BY 4.0/).textContent).toBe(text);
  });
});

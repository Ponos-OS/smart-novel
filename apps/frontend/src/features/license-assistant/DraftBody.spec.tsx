import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import { DraftBody } from './DraftBody';

const markdown = vi.hoisted(() => vi.fn());

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: ReactNode }) => {
    markdown(children);

    return <div data-testid="rendered">{children}</div>;
  },
}));

describe(DraftBody.name, () => {
  beforeEach(() => {
    markdown.mockClear();
  });

  it('renders the text of the draft', () => {
    // Act
    render(<DraftBody text="# CC BY 4.0 without resale" />);

    // Assert
    expect(screen.getByTestId('rendered')).toHaveTextContent(
      '# CC BY 4.0 without resale',
    );
  });

  it('does not render again for the same text, so an answer that left the draft alone does not flash it', () => {
    // Arrange
    const { rerender } = render(<DraftBody text="# CC BY 4.0" />);

    // Act
    rerender(<DraftBody text={'# CC BY 4.0'.slice()} />);
    rerender(<DraftBody text="# CC BY 4.0" />);

    // Assert
    expect(markdown).toHaveBeenCalledOnce();
  });

  it('renders again when the text changes', () => {
    // Arrange
    const { rerender } = render(<DraftBody text="# CC BY 4.0" />);

    // Act
    rerender(<DraftBody text="# CC BY 4.0 without resale" />);

    // Assert
    expect(markdown).toHaveBeenCalledTimes(2);
  });
});

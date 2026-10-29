import { render, screen } from '@testing-library/react';

import { DisclaimerList } from './DisclaimerList';

describe(DisclaimerList.name, () => {
  it('shows every disclaimer, open, under a heading', () => {
    // Act
    render(
      <DisclaimerList
        disclaimers={[
          'This is not legal advice.',
          'This license is no longer equivalent to the canonical one.',
        ]}
      />,
    );

    // Assert
    expect(
      screen.getByRole('heading', { name: 'Disclaimers' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('listitem').map((item) => item.textContent),
    ).toEqual([
      'This is not legal advice.',
      'This license is no longer equivalent to the canonical one.',
    ]);
  });

  it('cannot be collapsed or hidden', () => {
    // Act
    const { container } = render(
      <DisclaimerList disclaimers={['This is not legal advice.']} />,
    );

    // Assert
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(container.querySelector('details')).toBeNull();
    expect(
      screen.getByText('This is not legal advice.'),
    ).toBeVisible();
  });

  it('keeps two identical disclaimers', () => {
    // Act
    render(
      <DisclaimerList
        disclaimers={['Consult a lawyer.', 'Consult a lawyer.']}
      />,
    );

    // Assert
    expect(screen.getAllByText('Consult a lawyer.')).toHaveLength(2);
  });
});

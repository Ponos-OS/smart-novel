import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Pagination } from './Pagination';

describe(Pagination.name, () => {
  function renderPagination(
    overrides: Partial<Parameters<typeof Pagination>[0]> = {},
  ) {
    const props = {
      currentPage: 1,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: false,
      onPageChange: vi.fn(),
      onNext: vi.fn(),
      onPrevious: vi.fn(),
      ...overrides,
    };

    return { ...render(<Pagination {...props} />), props };
  }

  function visiblePages() {
    return screen
      .getAllByRole('button')
      .map((button) => button.textContent)
      .filter((text) => /^\d+$/.test(text ?? ''));
  }

  it.each([
    {
      currentPage: 1,
      totalPages: 5,
      expected: ['1', '2', '3', '4', '5'],
    },
    { currentPage: 1, totalPages: 10, expected: ['1', '2', '10'] },
    {
      currentPage: 4,
      totalPages: 10,
      expected: ['1', '3', '4', '5', '10'],
    },
    {
      currentPage: 5,
      totalPages: 10,
      expected: ['1', '4', '5', '6', '10'],
    },
    {
      currentPage: 9,
      totalPages: 10,
      expected: ['1', '8', '9', '10'],
    },
    { currentPage: 10, totalPages: 10, expected: ['1', '9', '10'] },
  ])(
    'lists $expected on page $currentPage of $totalPages',
    ({ currentPage, totalPages, expected }) => {
      renderPagination({ currentPage, totalPages });

      expect(visiblePages()).toEqual(expected);
    },
  );

  it.each([
    { currentPage: 1, ellipses: 1 },
    { currentPage: 3, ellipses: 1 },
    { currentPage: 5, ellipses: 2 },
    { currentPage: 8, ellipses: 1 },
    { currentPage: 10, ellipses: 1 },
  ])(
    'shows $ellipses gap marker(s) on page $currentPage of 10',
    ({ currentPage, ellipses }) => {
      renderPagination({ currentPage, totalPages: 10 });

      expect(screen.getAllByText('...')).toHaveLength(ellipses);
    },
  );

  it('shows no gap marker when every page fits', () => {
    renderPagination({ totalPages: 5 });

    expect(screen.queryByText('...')).not.toBeInTheDocument();
  });

  it('says which page the reader is on for narrow screens', () => {
    renderPagination({ currentPage: 4, totalPages: 10 });

    expect(screen.getByText('Page 4 of 10')).toBeInTheDocument();
  });

  it('asks for the clicked page number', async () => {
    const user = userEvent.setup();
    const { props } = renderPagination({
      currentPage: 1,
      totalPages: 3,
    });

    await user.click(screen.getByRole('button', { name: '3' }));

    expect(props.onPageChange).toHaveBeenCalledExactlyOnceWith(3);
  });

  it('goes forward and back with Next and Previous', async () => {
    const user = userEvent.setup();
    const { props } = renderPagination({
      currentPage: 2,
      hasNextPage: true,
      hasPreviousPage: true,
    });

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(
      screen.getByRole('button', { name: 'Previous' }),
    );

    expect(props.onNext).toHaveBeenCalledOnce();
    expect(props.onPrevious).toHaveBeenCalledOnce();
  });

  it('disables Previous on the first page and Next on the last', () => {
    renderPagination({
      currentPage: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });

    expect(
      screen.getByRole('button', { name: 'Previous' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Next' }),
    ).toBeDisabled();
  });
});

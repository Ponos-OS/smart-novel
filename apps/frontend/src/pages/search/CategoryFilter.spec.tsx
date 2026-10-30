import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CategoryFilter } from './CategoryFilter';

const categories = [
  { name: 'Fantasy', approximateNovelCount: 1203 },
  { name: 'Mystery', approximateNovelCount: 87 },
];

function renderFilter(
  props: Partial<Parameters<typeof CategoryFilter>[0]> = {},
) {
  const onToggleInclude = vi.fn();
  const onToggleExclude = vi.fn();
  const onShowMore = vi.fn();

  render(
    <CategoryFilter
      availableCategories={categories}
      includeCategories={[]}
      excludeCategories={[]}
      onToggleInclude={onToggleInclude}
      onToggleExclude={onToggleExclude}
      onShowMore={onShowMore}
      {...props}
    />,
  );

  return {
    onToggleInclude,
    onToggleExclude,
    onShowMore,
    user: userEvent.setup(),
  };
}

const groupOf = (heading: string) =>
  within(
    screen.getByRole('heading', { name: heading }).parentElement!,
  );

describe('CategoryFilter', () => {
  it('lists every category in both groups with its estimated count', () => {
    renderFilter();

    for (const heading of [
      'Include Categories',
      'Exclude Categories',
    ]) {
      expect(
        groupOf(heading).getByRole('button', { name: /Fantasy/ }),
      ).toHaveTextContent('~1.2K');
      expect(
        groupOf(heading).getByRole('button', { name: /Mystery/ }),
      ).toHaveTextContent('~87');
    }
  });

  it('toggles include and exclude with the plain category name', async () => {
    const { user, onToggleInclude, onToggleExclude } = renderFilter();

    await user.click(
      groupOf('Include Categories').getByRole('button', {
        name: /Fantasy/,
      }),
    );
    await user.click(
      groupOf('Exclude Categories').getByRole('button', {
        name: /Mystery/,
      }),
    );

    expect(onToggleInclude).toHaveBeenCalledExactlyOnceWith(
      'Fantasy',
    );
    expect(onToggleExclude).toHaveBeenCalledExactlyOnceWith(
      'Mystery',
    );
  });

  it('marks the selected categories', () => {
    renderFilter({
      includeCategories: ['Fantasy'],
      excludeCategories: ['Mystery'],
    });

    expect(
      groupOf('Include Categories').getByRole('button', {
        name: /Fantasy/,
      }),
    ).toHaveClass('bg-green-600');
    expect(
      groupOf('Exclude Categories').getByRole('button', {
        name: /Mystery/,
      }),
    ).toHaveClass('bg-red-600');
  });

  it('offers to show more categories only while there are more', async () => {
    const { user, onShowMore } = renderFilter({ hasMore: true });

    await user.click(
      screen.getByRole('button', { name: 'Show more categories' }),
    );

    expect(onShowMore).toHaveBeenCalledOnce();
  });

  it('does not offer it on the last page', () => {
    renderFilter({ hasMore: false });

    expect(
      screen.queryByRole('button', { name: 'Show more categories' }),
    ).not.toBeInTheDocument();
  });

  it('disables the action while the next page loads', () => {
    renderFilter({ hasMore: true, isLoadingMore: true });

    expect(
      screen.getByRole('button', { name: 'Loading...' }),
    ).toBeDisabled();
  });
});

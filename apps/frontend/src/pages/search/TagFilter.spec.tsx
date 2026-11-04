import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TagFilter } from './TagFilter';

const tags = [
  { name: 'Fantasy', approximateNovelCount: 1203 },
  { name: 'Mystery', approximateNovelCount: 87 },
];

function renderFilter(
  props: Partial<Parameters<typeof TagFilter>[0]> = {},
) {
  const onToggleInclude = vi.fn();
  const onToggleExclude = vi.fn();
  const onShowMore = vi.fn();

  render(
    <TagFilter
      availableTags={tags}
      includeTags={[]}
      excludeTags={[]}
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

describe('TagFilter', () => {
  it('lists every tag in both groups with its estimated count', () => {
    renderFilter();

    for (const heading of ['Include Tags', 'Exclude Tags']) {
      expect(
        groupOf(heading).getByRole('button', { name: /Fantasy/ }),
      ).toHaveTextContent('~1.2K');
      expect(
        groupOf(heading).getByRole('button', { name: /Mystery/ }),
      ).toHaveTextContent('~87');
    }
  });

  it('toggles include and exclude with the plain tag name', async () => {
    const { user, onToggleInclude, onToggleExclude } = renderFilter();

    await user.click(
      groupOf('Include Tags').getByRole('button', {
        name: /Fantasy/,
      }),
    );
    await user.click(
      groupOf('Exclude Tags').getByRole('button', {
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

  it('marks the selected tags', () => {
    renderFilter({
      includeTags: ['Fantasy'],
      excludeTags: ['Mystery'],
    });

    const included = groupOf('Include Tags').getByRole('button', {
      name: /Fantasy/,
    });
    expect(included).toHaveClass('bg-green-600');
    expect(included).toHaveAttribute('aria-pressed', 'true');
    expect(
      groupOf('Include Tags').getByRole('button', {
        name: /Mystery/,
      }),
    ).toHaveAttribute('aria-pressed', 'false');
    expect(
      groupOf('Exclude Tags').getByRole('button', {
        name: /Mystery/,
      }),
    ).toHaveClass('bg-red-600');
  });

  it('offers to show more tags only while there are more', async () => {
    const { user, onShowMore } = renderFilter({ hasMore: true });

    await user.click(
      screen.getByRole('button', { name: 'Show more tags' }),
    );

    expect(onShowMore).toHaveBeenCalledOnce();
  });

  it('does not offer it on the last page', () => {
    renderFilter({ hasMore: false });

    expect(
      screen.queryByRole('button', { name: 'Show more tags' }),
    ).not.toBeInTheDocument();
  });

  it('disables the action while the next page loads', () => {
    renderFilter({ hasMore: true, isLoadingMore: true });

    expect(
      screen.getByRole('button', { name: 'Loading...' }),
    ).toBeDisabled();
  });

  describe('search', () => {
    it('shows the search field only when it can search', () => {
      renderFilter();

      expect(
        screen.queryByLabelText('Search tags'),
      ).not.toBeInTheDocument();
    });

    it('reports what is typed', async () => {
      const onSearchTextChange = vi.fn();
      const { user } = renderFilter({
        searchText: '',
        onSearchTextChange,
      });

      await user.type(screen.getByLabelText('Search tags'), 'sci');

      expect(onSearchTextChange).toHaveBeenLastCalledWith('i');
      expect(onSearchTextChange).toHaveBeenCalledTimes(3);
    });

    it('shows a selected tag without a count', () => {
      renderFilter({
        availableTags: [{ name: 'Fantasy' }],
        includeTags: ['Fantasy'],
      });

      expect(
        groupOf('Include Tags').getByRole('button', {
          name: 'Fantasy',
        }),
      ).toBeVisible();
    });
  });
});

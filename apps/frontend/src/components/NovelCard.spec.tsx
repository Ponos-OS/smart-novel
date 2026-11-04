import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createMemoryRouter,
  RouterProvider,
  useLocation,
} from 'react-router-dom';

import { NovelCard } from './NovelCard';

const novelId = '93fec4bf-2f66-4e4a-9572-7aa4871f1458';
const now = new Date('2026-11-02T12:00:00.000Z');

const baseNovel = {
  id: novelId,
  name: 'The Lighthouse Keeper',
  tags: ['Fantasy', 'Mystery'],
  state: 'ONGOING',
  coverUrl: null,
  description: 'A keeper guards a light that no ship has seen.',
  lastChapterPublishedAt: null,
  writer: { penName: 'Mira Vale' },
} as unknown as Parameters<typeof NovelCard>[0]['novel'];

function LocationProbe() {
  const { pathname, search } = useLocation();

  return <p data-testid="location">{pathname + search}</p>;
}

describe(NovelCard.name, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
  });

  afterEach(() => vi.useRealTimers());

  function renderCard(overrides: Record<string, unknown> = {}) {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: (
            <>
              <NovelCard novel={{ ...baseNovel, ...overrides }} />
              <LocationProbe />
            </>
          ),
        },
        { path: '*', element: <LocationProbe /> },
      ],
      { initialEntries: ['/'] },
    );

    return {
      user: userEvent.setup({
        advanceTimers: vi.advanceTimersByTime,
      }),
      ...render(<RouterProvider router={router} />),
    };
  }

  it('links to the novel', () => {
    renderCard();

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      `/novel/${novelId}`,
    );
  });

  it('shows the name, the pen name and the description', () => {
    renderCard();

    expect(
      screen.getByRole('heading', { name: 'The Lighthouse Keeper' }),
    ).toBeInTheDocument();
    expect(screen.getByText('By: Mira Vale')).toBeInTheDocument();
    expect(
      screen.getByText(
        'A keeper guards a light that no ship has seen.',
      ),
    ).toBeInTheDocument();
  });

  it('leaves the by-line out when the novel has no writer', () => {
    renderCard({ writer: null });

    expect(screen.queryByText(/^By:/)).not.toBeInTheDocument();
  });

  it('shows the cover when there is one', () => {
    renderCard({
      coverUrl: 'https://cdn.example.com/covers/lighthouse.webp',
    });

    expect(
      screen.getByRole('img', { name: baseNovel.name }),
    ).toHaveAttribute(
      'src',
      'https://cdn.example.com/covers/lighthouse.webp',
    );
  });

  it('falls back to a placeholder without a cover', () => {
    const { container } = renderCard({ coverUrl: null });

    expect(container.querySelector('img')).toBeNull();
    expect(
      screen.getByRole('img', { name: baseNovel.name }),
    ).toBeInTheDocument();
  });

  it.each([
    { length: 300, shown: 300, ellipsis: false },
    { length: 301, shown: 300, ellipsis: true },
  ])(
    'cuts a description of $length characters to $shown (ellipsis: $ellipsis)',
    ({ length, shown, ellipsis }) => {
      const description = 'a'.repeat(length);

      renderCard({ description });

      const expected = 'a'.repeat(shown) + (ellipsis ? '...' : '');
      expect(screen.getByText(expected)).toBeInTheDocument();
    },
  );

  it.each([
    { published: null, expected: 'No updates yet' },
    {
      published: '2026-11-02T00:00:00.000Z',
      expected: 'Recently updated',
    },
    {
      published: '2026-11-01T12:00:01.000Z',
      expected: 'Recently updated',
    },
    {
      published: '2026-11-01T12:00:00.000Z',
      expected: 'Updated: Nov 1, 2026',
    },
    {
      published: '2026-02-22T08:00:00.000Z',
      expected: 'Updated: Feb 22, 2026',
    },
  ])(
    'says "$expected" for a last chapter published at $published',
    ({ published, expected }) => {
      renderCard({ lastChapterPublishedAt: published });

      expect(screen.getByText(expected)).toBeInTheDocument();
    },
  );

  it('searches the tag of a clicked chip instead of opening the novel', async () => {
    const { user } = renderCard({ tags: ['Sci-Fi & Fantasy'] });

    await user.click(
      screen.getByRole('button', { name: 'Sci-Fi & Fantasy' }),
    );

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/search?tag=Sci-Fi%20%26%20Fantasy',
    );
  });
});

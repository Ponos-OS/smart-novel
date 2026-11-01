import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { NovelState } from '../../generated/graphql';
import { a11yViolations } from '../../test-utils/axe';
import { AdminNovelsPage } from './AdminNovelsPage';
import { useAdminNovels } from './use-admin-novels';
import { useWriterSuggestions } from './use-writer-suggestions';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { roles: ['admin'] }, loading: false }),
}));
vi.mock('./ContentStatsCards', () => ({
  ContentStatsCards: () => null,
}));
vi.mock('./use-admin-novels', () => ({
  ADMIN_NOVELS_KEY: 'AdminNovelsInfinite',
  useAdminNovels: vi.fn(),
}));
vi.mock('./use-writer-suggestions', () => ({
  useWriterSuggestions: vi.fn(),
}));

const mina = {
  userId: '364554362883670018',
  penName: 'Mina_Ardalan',
  name: 'Mina Ardalan',
  email: 'mina.ardalan@example.com',
};

describe('admin novels accessibility', () => {
  function renderPage() {
    vi.mocked(useAdminNovels).mockReturnValue({
      novels: [
        {
          id: 'c1d31ec2-f478-4648-b90b-d1e53de2a829',
          name: 'The Lantern Keeper',
          state: NovelState.Ongoing,
          firstChapterCreatedAt: '2026-10-30T09:15:00.000Z',
          estimatedChapterCount: 1203,
          license: { id: '3f7b0c1e', name: 'CC BY 4.0' },
          writer: mina,
        },
      ] as never,
      isLoading: false,
      isError: false,
      hasMore: true,
      isLoadingMore: false,
      loadMore: vi.fn(),
    });
    vi.mocked(useWriterSuggestions).mockReturnValue({
      writers: [mina],
      isLoading: false,
      isError: false,
      hasMore: false,
      isLoadingMore: false,
      loadMore: vi.fn(),
    });

    return {
      ...render(
        <MemoryRouter>
          <QueryClientProvider client={new QueryClient()}>
            <AdminNovelsPage />
          </QueryClientProvider>
        </MemoryRouter>,
      ),
      user: userEvent.setup(),
    };
  }

  it('should have nothing wrong with the list and its filters', async () => {
    const { container } = renderPage();

    expect(await a11yViolations(container)).toStrictEqual([]);
  });

  it('should have nothing wrong with the writer suggestions open and a writer picked', async () => {
    const { container, user } = renderPage();
    await user.click(
      screen.getByRole('combobox', { name: 'Writers' }),
    );

    expect(await a11yViolations(container)).toStrictEqual([]);

    await user.click(
      screen.getByRole('option', { name: /Mina_Ardalan/ }),
    );

    expect(await a11yViolations(container)).toStrictEqual([]);
  });

  it('should have nothing wrong with a range that is announced as wrong', async () => {
    const { container, user } = renderPage();
    await user.type(screen.getByLabelText('Minimum chapters'), '10');
    await user.type(screen.getByLabelText('Maximum chapters'), '2');

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(await a11yViolations(container)).toStrictEqual([]);
  });

  it('should have nothing wrong with the delete dialog open', async () => {
    const { user } = renderPage();
    await user.click(
      screen.getByRole('button', {
        name: 'Delete The Lantern Keeper',
      }),
    );

    expect(
      await a11yViolations(screen.getByRole('dialog')),
    ).toStrictEqual([]);
  });
});

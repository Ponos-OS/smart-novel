import {
  QueryClient,
  QueryClientProvider,
  useInfiniteQuery,
} from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';

import { GraphqlRequestError } from '../lib/graphql-fetcher';
import { useResetOnInvalidCursor } from './useResetOnInvalidCursor';

const queryKey = ['AdminCategoriesInfinite', 'fan'];
const firstPage = {
  names: ['fantasy'],
  endCursor: 'eyJhIjoiY2F0ZWdvcmllcyJ9.c2lnbmF0dXJl',
};

function renderList(
  fetchPage: (
    cursor: string | undefined,
  ) => Promise<typeof firstPage>,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  return renderHook(
    () => {
      const query = useInfiniteQuery({
        queryKey,
        initialPageParam: undefined as string | undefined,
        queryFn: ({ pageParam }) => fetchPage(pageParam),
        getNextPageParam: (page) => page.endCursor,
      });
      useResetOnInvalidCursor(queryKey, query.error);

      return query;
    },
    { wrapper },
  );
}

describe(useResetOnInvalidCursor.name, () => {
  it('should start the list over from the first page when a cursor is refused', async () => {
    const fetchPage = vi
      .fn<(cursor: string | undefined) => Promise<typeof firstPage>>()
      .mockResolvedValueOnce(firstPage)
      .mockRejectedValueOnce(
        new GraphqlRequestError('Invalid cursor'),
      )
      .mockResolvedValueOnce(firstPage);
    const { result } = renderList(fetchPage);
    await waitFor(() => expect(result.current.data).toBeDefined());

    await act(() => result.current.fetchNextPage());

    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(result.current.isError).toBe(false));
    expect(fetchPage).toHaveBeenNthCalledWith(2, firstPage.endCursor);
    expect(fetchPage).toHaveBeenNthCalledWith(3, undefined);
    expect(result.current.data?.pages).toEqual([firstPage]);
  });

  it('should leave any other error alone', async () => {
    const fetchPage = vi
      .fn<(cursor: string | undefined) => Promise<typeof firstPage>>()
      .mockResolvedValueOnce(firstPage)
      .mockRejectedValueOnce(new GraphqlRequestError('Unauthorized'));
    const { result } = renderList(fetchPage);
    await waitFor(() => expect(result.current.data).toBeDefined());

    await act(() => result.current.fetchNextPage());

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });
});

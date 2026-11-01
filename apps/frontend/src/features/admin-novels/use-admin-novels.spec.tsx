import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';

import {
  NovelOrderField,
  NovelState,
  OrderDirection,
  useAdminNovelsQuery,
} from '../../generated/graphql';
import { GraphqlRequestError } from '../../lib/graphql-fetcher';
import { useAdminNovels } from './use-admin-novels';

vi.mock('../../generated/graphql', async () => ({
  ...(await vi.importActual('../../generated/graphql')),
  useAdminNovelsQuery: { fetcher: vi.fn() },
}));

const node = (id: string, name: string) => ({
  id,
  name,
  state: NovelState.Ongoing,
  firstChapterCreatedAt: null,
  estimatedChapterCount: 1,
  license: { id: 'l', name: 'CC BY 4.0' },
  writer: null,
});
const page = (
  nodes: ReturnType<typeof node>[],
  endCursor: string | null,
) => ({
  novelsConnection: {
    edges: nodes.map((n) => ({ node: n })),
    pageInfo: { endCursor, hasNextPage: endCursor !== null },
  },
});
const firstPage = page(
  [
    node(
      'c1d31ec2-f478-4648-b90b-d1e53de2a829',
      'The Journey Begins',
    ),
  ],
  'eyJhIjoibm92ZWxzIn0.c2lnbmF0dXJl',
);
const secondPage = page(
  [
    node(
      '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
      'The Lantern Keeper',
    ),
  ],
  null,
);

function renderList(
  filters: Parameters<typeof useAdminNovels>[0],
  orderBy: Parameters<typeof useAdminNovels>[1],
  enabled = true,
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
    (props: { filters: typeof filters; orderBy: typeof orderBy }) =>
      useAdminNovels(props.filters, props.orderBy, enabled),
    { wrapper, initialProps: { filters, orderBy } },
  );
}

describe(useAdminNovels.name, () => {
  let fetchPage: ReturnType<
    typeof vi.fn<(variables: unknown) => Promise<unknown>>
  >;

  beforeEach(() => {
    fetchPage = vi.fn<(variables: unknown) => Promise<unknown>>();
    vi.mocked(useAdminNovelsQuery.fetcher).mockImplementation(
      (variables) => () => fetchPage(variables) as never,
    );
  });

  it('should ask for a page of 20 with the filters and the order, then follow the cursor', async () => {
    fetchPage
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(secondPage);
    const orderBy = {
      field: NovelOrderField.FirstChapterCreatedAt,
      direction: OrderDirection.Desc,
    };
    const { result } = renderList(
      { state: NovelState.Ongoing },
      orderBy,
    );
    await waitFor(() =>
      expect(result.current.novels).toHaveLength(1),
    );

    await act(() => result.current.loadMore());

    await waitFor(() =>
      expect(result.current.novels).toHaveLength(2),
    );
    expect(fetchPage).toHaveBeenNthCalledWith(1, {
      filters: { state: NovelState.Ongoing },
      orderBy,
      first: 20,
      after: undefined,
    });
    expect(fetchPage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        after: firstPage.novelsConnection.pageInfo.endCursor,
      }),
    );
    expect(result.current.hasMore).toBeFalse();
  });

  it('should start again from the first page when the filters change', async () => {
    fetchPage.mockResolvedValue(firstPage);
    const { result, rerender } = renderList(undefined, undefined);
    await waitFor(() =>
      expect(result.current.novels).toHaveLength(1),
    );

    rerender({
      filters: { state: NovelState.Finished },
      orderBy: undefined,
    });

    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    expect(fetchPage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        filters: { state: NovelState.Finished },
        after: undefined,
      }),
    );
  });

  it('should not ask while it is disabled', () => {
    renderList(undefined, undefined, false);

    expect(fetchPage).not.toHaveBeenCalled();
  });

  it('should start the list over from its first page when a cursor is refused', async () => {
    fetchPage
      .mockResolvedValueOnce(firstPage)
      .mockRejectedValueOnce(
        new GraphqlRequestError('Invalid cursor'),
      )
      .mockResolvedValueOnce(firstPage);
    const { result } = renderList(undefined, undefined);
    await waitFor(() =>
      expect(result.current.novels).toHaveLength(1),
    );

    await act(() => result.current.loadMore());

    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(3));
    expect(fetchPage).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ after: undefined }),
    );
    await waitFor(() => expect(result.current.isError).toBeFalse());
  });
});

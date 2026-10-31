import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { WriterRequestStatus } from '../../generated/graphql';
import { WriterAccessSection } from './WriterAccessSection';

const query = vi.hoisted(() => ({
  useMyWriterRequestQuery: vi.fn(),
}));
let auth: { user: { roles: string[] } | null };

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('../../generated/graphql', async () => ({
  ...(await vi.importActual('../../generated/graphql')),
  useMyWriterRequestQuery: query.useMyWriterRequestQuery,
  useRequestWriterAccessMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

describe('WriterAccessSection', () => {
  beforeEach(() => {
    query.useMyWriterRequestQuery.mockReset();
    query.useMyWriterRequestQuery.mockReturnValue({
      data: { myWriterRequest: null },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it('shows the button to a user and opens the dialog', async () => {
    auth = { user: { roles: ['user'] } };
    render(<WriterAccessSection />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Become a writer' }),
    );

    expect(
      screen.getByRole('dialog', { name: 'Become a writer' }),
    ).toBeInTheDocument();
  });

  it('shows the state of the latest request', () => {
    auth = { user: { roles: ['user'] } };
    query.useMyWriterRequestQuery.mockReturnValue({
      data: {
        myWriterRequest: { status: WriterRequestStatus.Pending },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<WriterAccessSection />);

    expect(screen.getByText('Request pending')).toBeInTheDocument();
  });

  it.each([
    ['a writer', { user: { roles: ['writer'] } }],
    ['an admin', { user: { roles: ['admin'] } }],
    ['someone with no role', { user: { roles: [] } }],
    ['a visitor who is not signed in', { user: null }],
  ])(
    'shows nothing to %s and does not ask the server',
    (_name, value) => {
      auth = value;

      const { container } = render(<WriterAccessSection />);

      expect(container).toBeEmptyDOMElement();
      expect(query.useMyWriterRequestQuery).toHaveBeenCalledWith(
        {},
        { enabled: false },
      );
    },
  );

  it.each([
    ['loading', { isLoading: true, isError: false }],
    ['failed', { isLoading: false, isError: true }],
  ])('shows nothing while the request is %s', (_name, state) => {
    auth = { user: { roles: ['user'] } };
    query.useMyWriterRequestQuery.mockReturnValue({
      data: undefined,
      refetch: vi.fn(),
      ...state,
    });

    const { container } = render(<WriterAccessSection />);

    expect(container).toBeEmptyDOMElement();
  });
});

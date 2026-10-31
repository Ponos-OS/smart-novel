import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { Header } from './Header';

const logout = vi.fn();
let auth: {
  user: {
    roles: string[];
    name: string;
    preferredUsername: string;
    email: string;
  } | null;
  isAuthenticated: boolean;
  loading: boolean;
};

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ ...auth, login: vi.fn(), logout }),
}));

function signedInAs(roles: string[]) {
  auth = {
    user: {
      roles,
      name: 'Jane Doe',
      preferredUsername: 'jane',
      email: 'jane@smart-novel.localhost',
    },
    isAuthenticated: true,
    loading: false,
  };
}

async function openUserMenu() {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { name: 'User menu' }));

  return user;
}

describe('Header user menu', () => {
  beforeEach(() => logout.mockReset());

  it.each([
    {
      role: 'a plain user',
      roles: ['user'],
      items: ['Manage account', 'Settings'],
    },
    {
      role: 'a writer',
      roles: ['writer'],
      items: ['Manage account', 'Licenses and terms', 'Settings'],
    },
    {
      role: 'an admin',
      roles: ['admin'],
      items: [
        'Manage account',
        'Licenses and terms',
        'Manage categories',
        'Writer requests',
        'Settings',
      ],
    },
  ])('lists the entries of $role', async ({ roles, items }) => {
    signedInAs(roles);

    await openUserMenu();

    expect(
      screen
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
        .filter((text) => text !== 'Sign out'),
    ).toEqual(items);
  });

  it('links to the pages', async () => {
    signedInAs(['admin']);

    await openUserMenu();

    expect(
      screen.getByRole('menuitem', { name: 'Manage categories' }),
    ).toHaveAttribute('href', '/admin/categories');
    expect(
      screen.getByRole('menuitem', { name: 'Writer requests' }),
    ).toHaveAttribute('href', '/admin/writer-requests');
    expect(
      screen.getByRole('menuitem', { name: 'Settings' }),
    ).toHaveAttribute('href', '/settings');
  });

  it('signs out and closes the menu', async () => {
    signedInAs(['user']);
    const user = await openUserMenu();

    await user.click(
      screen.getByRole('menuitem', { name: 'Sign out' }),
    );

    expect(logout).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes with Escape and hands focus back to the avatar', async () => {
    signedInAs(['user']);
    const user = await openUserMenu();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'User menu' }),
    ).toHaveFocus();
  });

  it('offers a login button instead when signed out', () => {
    auth = { user: null, isAuthenticated: false, loading: false };

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole('button', { name: 'User menu' }),
    ).not.toBeInTheDocument();
  });
});

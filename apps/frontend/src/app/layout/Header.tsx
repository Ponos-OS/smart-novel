import { isWriterOrHigher } from '@smart-novel/shared';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { ThemeToggle } from '../../components/ThemeToggle';
import { useAuth } from '../../hooks/useAuth';
import { getInitials } from '../../utils/get-initials';

const ZITADEL_CONSOLE_URL = `${window.location.origin}/ui/console/`;

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/search', label: 'Search' },
] as const;

export function Header() {
  const { user, isAuthenticated, loading, login, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const closeMenu = () => setIsMenuOpen(false);
  const isWriter = isWriterOrHigher(user?.roles ?? []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const initials = user
    ? getInitials(user.name, user.preferredUsername, user.email)
    : '?';

  return (
    <header className="border-b border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link
              to="/"
              className="text-xl font-bold text-gray-900 dark:text-white"
            >
              Smart Novel
            </Link>
            <nav className="hidden space-x-4 md:flex">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="text-gray-700 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            {/* Desktop auth controls */}
            <div className="hidden md:flex md:items-center md:space-x-3">
              {!loading &&
                (isAuthenticated ? (
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() =>
                        setIsDropdownOpen(!isDropdownOpen)
                      }
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-offset-gray-800"
                      aria-label="User menu"
                      aria-expanded={isDropdownOpen}
                      aria-haspopup="true"
                    >
                      {initials}
                    </button>

                    {isDropdownOpen && (
                      <div className="absolute right-0 z-50 mt-2 w-48 origin-top-right rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-700">
                        <a
                          href={ZITADEL_CONSOLE_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600"
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          Manage account
                        </a>
                        {isWriter && (
                          <Link
                            to="/licenses"
                            className="block px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600"
                            onClick={() => setIsDropdownOpen(false)}
                          >
                            Licenses and terms
                          </Link>
                        )}
                        <Link
                          to="/settings"
                          className="block px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600"
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          Settings
                        </Link>
                        <hr className="my-1 border-gray-200 dark:border-gray-600" />
                        <button
                          onClick={() => {
                            setIsDropdownOpen(false);
                            logout();
                          }}
                          className="block w-full cursor-pointer px-4 py-2 text-left text-sm text-red-600 transition-colors hover:bg-gray-100 dark:text-red-400 dark:hover:bg-gray-600"
                        >
                          Sign out
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={login}
                    title="Login"
                    aria-label="Login"
                    className="cursor-pointer rounded-md bg-blue-600 p-2 text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1"
                      />
                    </svg>
                  </button>
                ))}
            </div>
            <ThemeToggle />
            {/* Hamburger button - mobile only */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="cursor-pointer rounded-md p-2 text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 md:hidden"
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700 md:hidden">
            <nav className="flex flex-col space-y-3">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={closeMenu}
                  className="rounded-md px-3 py-2 text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            {!loading && (
              <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
                {isAuthenticated ? (
                  <div className="flex flex-col space-y-2 px-3">
                    <div className="flex items-center space-x-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white dark:bg-blue-500">
                        {initials}
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {user?.name ||
                          user?.preferredUsername ||
                          user?.email}
                      </span>
                    </div>
                    <a
                      href={ZITADEL_CONSOLE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={closeMenu}
                      className="rounded-md px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600"
                    >
                      Manage account
                    </a>
                    {isWriter && (
                      <Link
                        to="/licenses"
                        onClick={closeMenu}
                        className="rounded-md px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600"
                      >
                        Licenses and terms
                      </Link>
                    )}
                    <Link
                      to="/settings"
                      onClick={closeMenu}
                      className="rounded-md px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600"
                    >
                      Settings
                    </Link>
                    <button
                      onClick={() => {
                        closeMenu();
                        logout();
                      }}
                      className="cursor-pointer rounded-md px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-gray-100 dark:text-red-400 dark:hover:bg-gray-600"
                    >
                      Sign out
                    </button>
                  </div>
                ) : (
                  <div className="px-3">
                    <button
                      onClick={() => {
                        closeMenu();
                        login();
                      }}
                      title="Login"
                      aria-label="Login"
                      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1"
                        />
                      </svg>
                      <span>Login</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

import {
  createBrowserRouter,
  Outlet,
  RouterProvider,
} from 'react-router-dom';
import { Toaster } from 'sonner';

import { PlatformTermsGate } from '../features/platform-terms/PlatformTermsGate';
import { CallbackPage } from '../pages/auth/CallbackPage';
import { HomePage } from '../pages/home/HomePage';
import { LicensesAndTermsPage } from '../pages/licenses/LicensesAndTermsPage';
import { ChapterCreatePage } from '../pages/novel/ChapterCreatePage';
import { ChapterEditPage } from '../pages/novel/ChapterEditPage';
import { ChapterListPage } from '../pages/novel/ChapterListPage';
import { ChapterReadPage } from '../pages/novel/ChapterReadPage';
import { NovelCreatePage } from '../pages/novel/NovelCreatePage';
import { NovelEditPage } from '../pages/novel/NovelEditPage';
import { NovelLayout } from '../pages/novel/NovelLayout';
import { SearchPage } from '../pages/search/SearchPage';
import { SettingsPage } from '../pages/settings/SettingsPage';
import { Layout } from './layout/Layout';

/**
 * @description The terms gate needs the router context (it steps aside on `/licenses`), so it lives inside the routes.
 */
function RootRoute() {
  return (
    <>
      <Outlet />
      <PlatformTermsGate />
    </>
  );
}

/**
 * @description
 * A data router (rather than plain `<BrowserRouter>`/`<Routes>`) is required for `useBlocker`, which we use to prompt before navigating away from a page.
 */
const router = createBrowserRouter([
  {
    element: <RootRoute />,
    children: [
      // Routes with Layout (Header + Footer)
      {
        path: '/',
        element: (
          <Layout>
            <HomePage />
          </Layout>
        ),
      },
      {
        path: '/novels/new',
        element: (
          <Layout>
            <NovelCreatePage />
          </Layout>
        ),
      },
      {
        path: '/novels/:novelId/edit',
        element: (
          <Layout>
            <NovelEditPage />
          </Layout>
        ),
      },
      {
        path: '/search',
        element: (
          <Layout>
            <SearchPage />
          </Layout>
        ),
      },
      {
        path: '/licenses',
        element: (
          <Layout>
            <LicensesAndTermsPage />
          </Layout>
        ),
      },
      {
        path: '/licenses/draft',
        lazy: async () => {
          const { LicenseAssistantPage } =
            await import('../pages/licenses/LicenseAssistantPage');

          return {
            element: (
              <Layout>
                <LicenseAssistantPage />
              </Layout>
            ),
          };
        },
      },
      {
        path: '/settings',
        element: (
          <Layout>
            <SettingsPage />
          </Layout>
        ),
      },

      {
        path: '/admin/licenses',
        lazy: async () => {
          const { AdminDefaultLicensePage } =
            await import('../features/admin-licenses/AdminDefaultLicensePage');

          return {
            element: (
              <Layout>
                <AdminDefaultLicensePage />
              </Layout>
            ),
          };
        },
      },

      // Auth callback route
      { path: '/auth/callback', element: <CallbackPage /> },

      // Novel pages without Layout
      {
        path: '/novel/:id',
        element: <NovelLayout />,
        children: [
          { index: true, element: <ChapterListPage /> },
          { path: 'chapters/new', element: <ChapterCreatePage /> },
          {
            path: 'chapters/:chapterId',
            element: <ChapterReadPage />,
          },
          {
            path: 'chapters/:chapterId/edit',
            element: <ChapterEditPage />,
          },
        ],
      },
    ],
  },
]);

export function App() {
  return (
    <>
      <Toaster position="top-right" richColors />
      <RouterProvider router={router} />
    </>
  );
}

export default App;

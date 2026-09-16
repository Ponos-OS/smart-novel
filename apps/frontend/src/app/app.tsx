import {
  createBrowserRouter,
  RouterProvider,
} from 'react-router-dom';
import { Toaster } from 'sonner';

import { ThemeProvider } from '../hooks/useTheme';
import { CallbackPage } from '../pages/auth/CallbackPage';
import { HomePage } from '../pages/home/HomePage';
import { ChapterEditPage } from '../pages/novel/ChapterEditPage';
import { ChapterListPage } from '../pages/novel/ChapterListPage';
import { ChapterReadPage } from '../pages/novel/ChapterReadPage';
import { NovelLayout } from '../pages/novel/NovelLayout';
import { SearchPage } from '../pages/search/SearchPage';
import { SettingsPage } from '../pages/settings/SettingsPage';
import { Layout } from './layout/Layout';

/**
 * A data router (rather than plain `<BrowserRouter>`/`<Routes>`) is required for
 * `useBlocker`, which `ChapterContentEditor` uses to prompt before navigating away from
 * an unsaved edit — that includes breadcrumb links and the browser back button, not just
 * an in-page Cancel button.
 */
const router = createBrowserRouter([
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
    path: '/search',
    element: (
      <Layout>
        <SearchPage />
      </Layout>
    ),
  },
  {
    path: '/settings',
    element: (
      <Layout>
        <SettingsPage />
      </Layout>
    ),
  },

  // Auth callback route
  { path: '/auth/callback', element: <CallbackPage /> },

  // Novel pages without Layout (have their own theme toggle)
  {
    path: '/novel/:id',
    element: <NovelLayout />,
    children: [
      { index: true, element: <ChapterListPage /> },
      { path: 'chapters/:chapterId', element: <ChapterReadPage /> },
      {
        path: 'chapters/:chapterId/edit',
        element: <ChapterEditPage />,
      },
    ],
  },
]);

export function App() {
  return (
    <ThemeProvider>
      <Toaster position="top-right" richColors />
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}

export default App;

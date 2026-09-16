import { BrowserRouter, Route, Routes } from 'react-router-dom';
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

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          {/* Routes with Layout (Header + Footer) */}
          <Route
            path="/"
            element={
              <Layout>
                <HomePage />
              </Layout>
            }
          />
          <Route
            path="/search"
            element={
              <Layout>
                <SearchPage />
              </Layout>
            }
          />
          <Route
            path="/settings"
            element={
              <Layout>
                <SettingsPage />
              </Layout>
            }
          />

          {/* Auth callback route */}
          <Route path="/auth/callback" element={<CallbackPage />} />

          {/* Novel pages without Layout (have their own theme toggle) */}
          <Route path="/novel/:id" element={<NovelLayout />}>
            <Route index element={<ChapterListPage />} />
            <Route
              path="chapters/:chapterId"
              element={<ChapterReadPage />}
            />
            <Route
              path="chapters/:chapterId/edit"
              element={<ChapterEditPage />}
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;

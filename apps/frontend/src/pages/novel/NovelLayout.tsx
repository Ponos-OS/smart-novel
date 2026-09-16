import {
  Outlet,
  useOutletContext,
  useParams,
} from 'react-router-dom';

import { ThemeToggle } from '../../components/ThemeToggle';
import {
  GetNovelQuery,
  NovelAction,
  useGetNovelQuery,
} from '../../generated/graphql';
import { useAuth } from '../../hooks/useAuth';
import { Breadcrumbs } from './Breadcrumbs';

type Novel = GetNovelQuery['novel'];

export interface NovelOutletContext {
  novel: Novel;
  canEditContent: boolean;
  canManageTts: boolean;
}

export function useNovelOutletContext() {
  return useOutletContext<NovelOutletContext>();
}

export function NovelLayout() {
  const { id } = useParams<{ id: string }>();
  const { loading: authLoading } = useAuth();

  const {
    data: novelData,
    isLoading: novelLoading,
    error: novelError,
  } = useGetNovelQuery(
    { id: id ?? '' },
    { enabled: !!id && !authLoading },
  );

  const novel = novelData?.novel ?? null;

  if (novelLoading && !novel) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Loading novel...
          </p>
        </div>
      </div>
    );
  }

  if (novelError || !novel) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center text-red-600 dark:text-red-400">
          <p>
            {novelError ? 'Failed to fetch novel' : 'Novel not found'}
          </p>
        </div>
      </div>
    );
  }

  const canManageTts =
    novel.allowedActions?.includes(NovelAction.ManageTts) ?? false;
  const canEditContent =
    novel.allowedActions?.includes(NovelAction.EditContent) ?? false;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Theme Toggle - Fixed top-right */}
      <div className="fixed right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Breadcrumbs novelId={novel.id} novelName={novel.name} />

        <Outlet context={{ novel, canEditContent, canManageTts }} />
      </div>
    </div>
  );
}

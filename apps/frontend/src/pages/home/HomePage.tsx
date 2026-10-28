import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '../../components/Button';
import { NovelCard } from '../../components/NovelCard';
import { Pagination } from '../../components/Pagination';
import { useGetNovelsQuery } from '../../generated/graphql';
import { useCanCreateNovel } from '../../hooks/useCanCreateNovel';

const PAGE_SIZE = 20;

export function HomePage() {
  const navigate = useNavigate();
  const { canCreate } = useCanCreateNovel();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCursors, setPageCursors] = useState<
    Map<number, string | null>
  >(new Map([[1, null]]));

  const cursor = pageCursors.get(currentPage) ?? null;

  const { data, isLoading, error } = useGetNovelsQuery(
    { first: PAGE_SIZE, after: cursor },
    { placeholderData: (prev) => prev },
  );

  const novelsData = data?.novelsConnection;
  const pageInfo = novelsData?.pageInfo;
  const novels = novelsData?.edges.map((edge) => edge.node) ?? [];

  const handleNext = () => {
    if (!pageInfo?.hasNextPage) {
      return;
    }
    const nextPage = currentPage + 1;
    setPageCursors((prev) => {
      const next = new Map(prev);
      next.set(nextPage, pageInfo.endCursor ?? null);
      return next;
    });
    setCurrentPage(nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrevious = () => {
    if (currentPage <= 1) {
      return;
    }
    setCurrentPage((prev) => prev - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isLoading && !novelsData) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Loading novels...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center text-red-600 dark:text-red-400">
          <p>Failed to fetch novels</p>
        </div>
      </div>
    );
  }

  // Estimate total pages (since we don't have total count from backend)
  const estimatedTotalPages = pageInfo?.hasNextPage
    ? currentPage + 5
    : currentPage;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Discover Novels
        </h1>
        {canCreate && (
          <Button
            variant="solid"
            color="blue"
            onClick={() => navigate('/novels/new')}
          >
            New novel
          </Button>
        )}
      </div>

      {novels.length === 0 ? (
        <div className="text-center text-gray-600 dark:text-gray-400">
          <p>No novels found.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-1">
            {novels.map((novel) => (
              <NovelCard key={novel.id} novel={novel} />
            ))}
          </div>

          {pageInfo && (
            <div className="mt-8">
              <Pagination
                currentPage={currentPage}
                totalPages={estimatedTotalPages}
                hasNextPage={pageInfo.hasNextPage}
                hasPreviousPage={pageInfo.hasPreviousPage}
                onPageChange={handlePageChange}
                onNext={handleNext}
                onPrevious={handlePrevious}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

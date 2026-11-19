import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '../../components/Button';
import { NovelCard } from '../../components/NovelCard';
import { Pagination } from '../../components/Pagination';
import { useGetNovelsQuery } from '../../generated/graphql';
import { useCanCreateNovel } from '../../hooks/useCanCreateNovel';
import { nodesOf } from '../../lib/connection';
import { isInvalidCursorError } from '../../lib/graphql-fetcher';

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

  const [handledError, setHandledError] = useState<unknown>(null);

  if (isInvalidCursorError(error) && handledError !== error) {
    setHandledError(error);
    setPageCursors(new Map([[1, null]]));
    setCurrentPage(1);
  }

  const novelsData = data?.novels;
  const pageInfo = novelsData?.pageInfo;
  const novels = novelsData ? nodesOf(novelsData) : [];

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
    if (page === currentPage + 1) {
      handleNext();
      return;
    }
    if (!pageCursors.has(page)) {
      return;
    }
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isLoading && !novelsData) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-gray-400">Loading novels...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center text-red-400">
          <p>Failed to fetch novels</p>
        </div>
      </div>
    );
  }

  // Only pages reached so far have a cursor; offer one more when there is a next page
  const lastKnownPage = Math.max(...pageCursors.keys(), currentPage);
  const reachablePages = pageInfo?.hasNextPage
    ? Math.max(lastKnownPage, currentPage + 1)
    : lastKnownPage;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">
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
        <div className="text-center text-gray-400">
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
                totalPages={reachablePages}
                hasNextPage={pageInfo.hasNextPage}
                hasPreviousPage={currentPage > 1}
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

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onPageChange: (page: number) => void;
  onNext: () => void;
  onPrevious: () => void;
}

export function Pagination({
  currentPage,
  totalPages,
  hasNextPage,
  hasPreviousPage,
  onPageChange,
  onNext,
  onPrevious,
}: PaginationProps) {
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const showPages = 5; // Number of page buttons to show

    if (totalPages <= showPages) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }

      // Always show last page if we have multiple pages
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div className="flex items-center justify-center space-x-2">
      {/* Previous Button */}
      <button
        onClick={onPrevious}
        disabled={!hasPreviousPage}
        className="cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700"
      >
        Previous
      </button>

      {/* Page Numbers */}
      <div className="hidden space-x-1 sm:flex">
        {getPageNumbers().map((page, index) => {
          if (page === '...') {
            return (
              <span
                key={`ellipsis-${index}`}
                className="px-3 py-2 text-gray-500"
              >
                ...
              </span>
            );
          }

          const pageNum = page as number;
          const isActive = pageNum === currentPage;

          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'border border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {pageNum}
            </button>
          );
        })}
      </div>

      {/* Mobile: Just show current page */}
      <div className="sm:hidden">
        <span className="text-sm text-gray-300">
          Page {currentPage} of {totalPages}
        </span>
      </div>

      {/* Next Button */}
      <button
        onClick={onNext}
        disabled={!hasNextPage}
        className="cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700"
      >
        Next
      </button>
    </div>
  );
}

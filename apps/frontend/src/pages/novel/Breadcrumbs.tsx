import { Link } from 'react-router-dom';

interface BreadcrumbsProps {
  novelId: string;
  novelName: string;
  chapterTitle?: string | null;
}

export function Breadcrumbs({
  novelId,
  novelName,
  chapterTitle,
}: BreadcrumbsProps) {
  return (
    <nav className="mb-4 flex items-center space-x-2 text-sm text-gray-400">
      <Link to="/" className="transition-colors hover:text-white">
        Home
      </Link>
      <span>/</span>
      <Link
        to={`/novel/${novelId}`}
        className="font-medium transition-colors text-white hover:text-blue-400"
      >
        {novelName}
      </Link>
      {chapterTitle && (
        <>
          <span>/</span>
          <span className="font-medium text-white">
            {chapterTitle}
          </span>
        </>
      )}
    </nav>
  );
}

import { Link, useNavigate } from 'react-router-dom';

import { Novel } from '../generated/graphql';

type NovelCardData = Pick<
  Novel,
  | 'id'
  | 'name'
  | 'author'
  | 'category'
  | 'state'
  | 'coverUrl'
  | 'description'
  | 'lastChapterPublishedAt'
>;

interface NovelCardProps {
  novel: NovelCardData;
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength) + '...';
}

function getLastUpdateDate(novel: NovelCardData): string {
  if (!novel.lastChapterPublishedAt) {
    return 'No updates yet';
  }

  const lastUpdate = new Date(novel.lastChapterPublishedAt);
  const now = new Date();
  const diffInMs = now.getTime() - lastUpdate.getTime();
  const diffInHours = diffInMs / (1000 * 60 * 60);

  if (diffInHours < 24) {
    return 'Recently updated';
  }

  // Format as "Updated: Feb 22, 2026"
  return `Updated: ${lastUpdate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
}

export function NovelCard({ novel }: NovelCardProps) {
  const navigate = useNavigate();

  const handleCategoryClick = (
    e: React.MouseEvent,
    category: string,
  ) => {
    e.preventDefault();
    navigate(`/search?category=${encodeURIComponent(category)}`);
  };

  return (
    <Link
      to={`/novel/${novel.id}`}
      className="block overflow-hidden rounded-lg border shadow-sm transition-shadow hover:shadow-md border-gray-700 bg-gray-800"
    >
      <div className="flex gap-4 p-4">
        {/* Cover Image */}
        <div className="flex-shrink-0">
          {novel.coverUrl ? (
            <img
              src={novel.coverUrl}
              alt={novel.name}
              className="h-32 w-24 rounded object-cover"
            />
          ) : (
            <div className="flex h-32 w-24 items-center justify-center rounded bg-gray-700">
              <span className="text-xs text-gray-400">No Cover</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col">
          {/* Last Update & Categories */}
          <div className="mb-2">
            <p className="mb-2 text-xs text-gray-400">
              {getLastUpdateDate(novel)}
            </p>
            <div className="flex flex-wrap gap-1">
              {novel.category.map((cat) => (
                <button
                  key={cat}
                  onClick={(e) => handleCategoryClick(e, cat)}
                  className="rounded-full px-2 py-1 text-xs font-medium transition-colors bg-blue-900 text-blue-200 hover:bg-blue-800"
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Novel Name */}
          <h3 className="mb-2 text-lg font-semibold text-white">
            {novel.name}
          </h3>

          {/* Description */}
          <p className="mb-2 flex-1 text-sm text-gray-300">
            {truncateText(novel.description, 300)}
          </p>

          {/* Author */}
          <p className="text-sm text-gray-400">By: {novel.author}</p>
        </div>
      </div>
    </Link>
  );
}

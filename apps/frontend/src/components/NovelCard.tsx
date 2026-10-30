import { Link, useNavigate } from 'react-router-dom';

import { Novel } from '../generated/graphql';
import { NovelCoverPlaceholder } from './NovelCoverPlaceholder';

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
      className="group flex gap-5 rounded-xl border border-gray-700/70 bg-gray-800 p-4 transition-colors hover:border-blue-500/50 hover:bg-gray-800/60"
    >
      {/* A cover with the shadow of a spine on its left edge */}
      <div className="relative h-40 w-28 shrink-0 overflow-hidden rounded-l-sm rounded-r-md shadow-lg shadow-black/40 ring-1 ring-white/10 after:absolute after:inset-y-0 after:left-0 after:w-2.5 after:bg-linear-to-r after:from-black/40 after:to-transparent">
        {novel.coverUrl ? (
          <img
            src={novel.coverUrl}
            alt={novel.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <NovelCoverPlaceholder
            title={novel.name}
            className="h-full w-full rounded-none"
          />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="font-serif text-xl font-semibold leading-snug text-white">
          {novel.name}
        </h3>
        <p className="mt-0.5 text-sm text-gray-400">
          By: {novel.author}
        </p>
        <p className="mt-3 flex-1 text-sm leading-relaxed text-gray-300">
          {truncateText(novel.description, 300)}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex flex-wrap gap-1.5">
            {novel.category.map((cat) => (
              <button
                key={cat}
                onClick={(e) => handleCategoryClick(e, cat)}
                className="cursor-pointer rounded-full bg-blue-950 px-2.5 py-1 text-xs font-medium text-blue-200 ring-1 ring-blue-800/60 transition-colors hover:bg-blue-900"
              >
                {cat}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            {getLastUpdateDate(novel)}
          </p>
        </div>
      </div>
    </Link>
  );
}

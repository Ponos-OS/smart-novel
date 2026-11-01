import { Link } from 'react-router-dom';

import { Button } from '../../components/Button';
import {
  type AdminNovelsQuery,
  NovelState,
} from '../../generated/graphql';

export type AdminNovel =
  AdminNovelsQuery['novelsConnection']['edges'][number]['node'];

interface NovelRowProps {
  novel: AdminNovel;
  onDelete: (novel: AdminNovel) => void;
}

const STATE_LABELS: Record<NovelState, string> = {
  [NovelState.Ongoing]: 'Ongoing',
  [NovelState.Finished]: 'Finished',
};

export function NovelRow({ novel, onDelete }: NovelRowProps) {
  const { writer } = novel;
  const details = [writer?.name, writer?.email].filter(Boolean);

  return (
    <tr className="border-t border-gray-700">
      <td className="px-4 py-3 align-top">
        <Link
          to={`/novel/${novel.id}`}
          className="font-medium text-white hover:text-blue-300"
        >
          {novel.name}
        </Link>
      </td>
      <td className="px-4 py-3 align-top">
        <p className="font-medium text-white">
          {writer?.penName ?? '-'}
        </p>
        {details.length > 0 && (
          <p className="text-sm text-gray-400">
            {details.join(' · ')}
          </p>
        )}
        {writer && details.length === 0 && (
          <p className="text-sm text-gray-500">{writer.userId}</p>
        )}
      </td>
      <td className="px-4 py-3 align-top text-sm text-gray-300">
        {STATE_LABELS[novel.state]}
      </td>
      <td
        className="whitespace-nowrap px-4 py-3 text-right align-top text-sm text-gray-300"
        title="An estimate from the database, not an exact count"
      >
        ~{novel.estimatedChapterCount.toLocaleString('en-US')}
      </td>
      <td className="px-4 py-3 align-top text-sm text-gray-300">
        {novel.license.name}
      </td>
      <td className="whitespace-nowrap px-4 py-3 align-top text-sm text-gray-400">
        {novel.firstChapterCreatedAt
          ? new Date(novel.firstChapterCreatedAt).toLocaleDateString(
              'en-US',
            )
          : '-'}
      </td>
      <td className="px-4 py-3 text-right align-top">
        <Button
          variant="chip"
          color="red"
          aria-label={`Delete ${novel.name}`}
          onClick={() => onDelete(novel)}
        >
          Delete
        </Button>
      </td>
    </tr>
  );
}

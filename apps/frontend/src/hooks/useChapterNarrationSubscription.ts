import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import {
  ChapterNarrationUpdatedDocument,
  ChapterNarrationUpdatedSubscription,
  GetChapterQuery,
  useGetChapterQuery,
} from '../generated/graphql';
import { useGraphQLSubscription } from './useGraphQLSubscription';

interface UseChapterNarrationSubscriptionOptions {
  chapterId: string;
  novelId: string;
  /** Only subscribe when true (e.g. when narration is processing) */
  enabled: boolean;
}

/**
 * @description
 * Subscribes to real-time chapter narration updates via graphql-ws, updates the TanStack
 * Query cache when the narration status changes, and returns the in-progress `percent`
 * (from `generating`/`uploading` events) — that field isn't part of the persisted chapter
 * query, so it's tracked as local hook state rather than written into the cache.
 */
export function useChapterNarrationSubscription({
  chapterId,
  novelId,
  enabled,
}: UseChapterNarrationSubscriptionOptions) {
  const queryClient = useQueryClient();
  const [percent, setPercent] = useState<number | null>(null);

  const onData = useCallback(
    (data: ChapterNarrationUpdatedSubscription) => {
      const event = data.chapterNarrationUpdated;
      setPercent(event.percent ?? null);

      const queryKey = useGetChapterQuery.getKey({
        novelId,
        chapterId,
      });

      queryClient.setQueryData<GetChapterQuery>(queryKey, (old) => {
        if (!old?.novel?.chapter) {
          return old;
        }

        return {
          ...old,
          novel: {
            ...old.novel,
            chapter: {
              ...old.novel.chapter,
              narrationStatus: event.status,
              narrationUrl:
                event.narrationUrl ?? old.novel.chapter.narrationUrl,
            },
          },
        };
      });
    },
    [chapterId, novelId, queryClient],
  );

  useGraphQLSubscription<ChapterNarrationUpdatedSubscription>({
    query: ChapterNarrationUpdatedDocument.toString(),
    variables: { chapterId },
    enabled: enabled && !!chapterId && !!novelId,
    onData,
  });

  return { percent: enabled ? percent : null };
}

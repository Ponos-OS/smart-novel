import { useCallback, useRef } from 'react';

import {
  useExplainWordMutation,
  WordExplanation,
} from '../generated/graphql';
import { TokenBucket } from '../utils/token-bucket';

interface ExplainInput {
  context: string;
  word: string;
}

interface ExplainState {
  data?: WordExplanation;
  error?: string;
  rateLimited?: boolean;
}

const cacheEntryLimit = Number(
  import.meta.env.VITE_EXPLAIN_CACHE_MAX_ENTRIES,
);

const tokenBucket = new TokenBucket({
  capacity: Number(import.meta.env.VITE_EXPLAIN_RATE_CAPACITY),
  refillPerSecond: Number(
    import.meta.env.VITE_EXPLAIN_RATE_REFILL_PER_SEC,
  ),
});

// Module-level so explained words survive chapter-to-chapter navigation.
const cacheByKey = new Map<string, WordExplanation>();
const requestToCacheKey = new Map<string, string>();

export function useWordExplain() {
  const inFlightRequestRef = useRef<Promise<ExplainState> | null>(
    null,
  );
  const inFlightSignatureRef = useRef<string | null>(null);
  const { mutateAsync } = useExplainWordMutation();

  const addToCache = useCallback((data: WordExplanation) => {
    const cache = cacheByKey;
    cache.set(data.cacheKey, data);

    while (cache.size > cacheEntryLimit) {
      const firstKey = cache.keys().next().value;
      if (firstKey) {
        cache.delete(firstKey);
      }
    }
  }, []);

  const explain = useCallback(
    async (input: ExplainInput): Promise<ExplainState> => {
      const signature = `${input.word.toLowerCase()}::${input.context}`;
      const existingKey = requestToCacheKey.get(signature);

      if (existingKey) {
        const cached = cacheByKey.get(existingKey);
        if (cached) {
          return { data: cached };
        }
      }

      if (
        inFlightSignatureRef.current === signature &&
        inFlightRequestRef.current
      ) {
        return inFlightRequestRef.current;
      }

      if (!tokenBucket.take(1)) {
        return { rateLimited: true };
      }

      inFlightSignatureRef.current = signature;

      const request = mutateAsync({
        word: input.word,
        context: input.context,
      })
        .then((response) => {
          const explained = response.explain;

          if (!explained) {
            return { error: 'No explanation returned.' };
          }

          requestToCacheKey.set(signature, explained.cacheKey);
          addToCache(explained);
          return { data: explained };
        })
        .catch(() => {
          return { error: 'Failed to fetch explanation.' };
        })
        .finally(() => {
          if (inFlightSignatureRef.current === signature) {
            inFlightSignatureRef.current = null;
            inFlightRequestRef.current = null;
          }
        });

      inFlightRequestRef.current = request;
      return request;
    },
    [addToCache, mutateAsync],
  );

  return { explain };
}

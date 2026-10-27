# Redis Usage and Memory Sizing

## What is stored

| Use                                                                           | Key                                            | Value                                                                                                           | TTL                                        | Size per entry                                                                     |
| ----------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------- |
| LLM word-explanation cache (`CacheService`, used by `LlmService.explainWord`) | `explain:<word>:<sha256 hex>` (about 80 bytes) | JSON: `meaning`, `simplifiedExplanation`, `synonyms[]`, `antonyms[]`, plus `instanceId` and `cachedAt` metadata | `LLM_CACHE_TTL` (`12h` in `.env.example`)  | about 0.6-1 KB payload; about 1-1.5 KB with key, dict entry and allocator overhead |
| Narration lock (`NarrationLockService`)                                       | `chapter_tts:<chapterId>`                      | random 11-character token                                                                                       | 1 hour (`LOCK_TTL_MS`), deleted on release | about 150 bytes                                                                    |
| Pub/sub (`tts-callbacks` publishes, `ChapterNarrationService` subscribes)     | channel, no key                                | none                                                                                                            | none                                       | nothing at rest                                                                    |

Only the LLM cache takes meaningful memory. 1,000 concurrent narration locks are about 150 KB.

## Sizing the LLM cache

Memory is roughly live keys times average entry size. Hits do not refresh the TTL, so a key lives for `LLM_CACHE_TTL` after it is first computed. The key includes the paragraph fingerprint, so the same word in a different paragraph is a separate entry.

Live keys are approximately the distinct (word, paragraph) lookups per TTL window.

| Distinct lookups per 12h | Memory at about 1.5 KB each |
| ------------------------ | --------------------------- |
| 10,000                   | about 15 MB                 |
| 100,000                  | about 150 MB                |
| 1,000,000                | about 1.5 GB                |

Expect low tens of MB early on. Each miss is an LLM call, so LLM cost and latency limit volume long before Redis memory does.

## Configured limits

From `infra/terraform/modules/redis/variables.tf`:

- [`max_memory`](https://github.com/Ponos-OS/smart-novel/blob/820af96a5c7b8fe468b4d9fd8a64a1b58a3208e1/infra/terraform/modules/redis/variables.tf#L24-L28): `512mb`.
- [`memory_limit`](https://github.com/Ponos-OS/smart-novel/blob/820af96a5c7b8fe468b4d9fd8a64a1b58a3208e1/infra/terraform/modules/redis/variables.tf#L36-L40) (container): `640Mi`.
- [`max_memory_policy`](https://github.com/Ponos-OS/smart-novel/blob/820af96a5c7b8fe468b4d9fd8a64a1b58a3208e1/infra/terraform/modules/redis/variables.tf#L30-L34): `allkeys-lfu`.

This covers more than 300k live explain entries. With `allkeys-lfu`, Redis evicts the least frequently used keys when full, which suits a pure cache.

## Important Notes

- `allkeys-lfu` can also evict `chapter_tts:*` locks under memory pressure, silently dropping a lock. Unlikely at this scale; if it matters, run locks on a separate Redis instance. `volatile-lfu` does not help because locks have TTLs too.
- `LLM_CACHE_TTL` is the main knob: halving it roughly halves steady-state memory but lowers the hit rate for popular words.
- Dropping the `metadata` field saves about 60 bytes per entry; the LLM payload dominates.
- The numbers above are estimates, not measurements. To measure: `redis-cli --scan --pattern 'explain:*' | wc -l` for the key count, `MEMORY USAGE <key>` on a sample, or RedisInsight (`enable_devtools = true`).

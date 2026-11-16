import Redis from 'ioredis';

function connect(): Redis {
  const host = process.env.HOST ?? 'localhost';
  const port = process.env.REDIS_PORT ?? '6379';

  return new Redis(`redis://${host}:${port}`, {
    password: process.env.REDIS_PASSWORD,
  });
}

/**
 * @description The ID of the job the lock of a chapter holds, or null when no narration runs. Call it right after the call that started
 * the job: before Beatrice answers that call the lock holds a token, and a job that is done releases it.
 */
export async function lockedJobOfChapter(
  chapterId: string,
): Promise<string | null> {
  const redis = connect();

  try {
    return await redis.get(`chapter_tts:${chapterId}`);
  } finally {
    await redis.quit();
  }
}

/**
 * @description Makes `jobId` the job the lock of the chapter holds, as if the backend had started it, once no other narration holds the
 * lock. The test can then report the job's updates itself without a job of Beatrice finishing first.
 */
export async function holdNarrationLock(
  chapterId: string,
  jobId: string,
  timeoutMs = 120_000,
): Promise<void> {
  const redis = connect();
  const deadline = Date.now() + timeoutMs;

  try {
    while (Date.now() < deadline) {
      const taken = await redis.set(
        `chapter_tts:${chapterId}`,
        jobId,
        'EX',
        600,
        'NX',
      );

      if (taken === 'OK') {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  } finally {
    await redis.quit();
  }

  throw new Error(
    `The lock of chapter ${chapterId} stayed held for ${timeoutMs}ms`,
  );
}

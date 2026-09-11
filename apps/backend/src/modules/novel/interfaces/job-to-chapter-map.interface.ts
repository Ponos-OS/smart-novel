export interface IJobToChapterMap {
  /**
   * @description Remembers which chapter a Beatrice `generateAudio` job belongs to.
   */
  set(jobId: string, chapterId: string): Promise<void>;

  /**
   * @description Looks up the chapter a job belongs to. Returns `undefined` for an unknown or expired jobId — callers must treat that as a miss, not an error.
   */
  get(jobId: string): Promise<string | undefined>;
}

export const JOB_TO_CHAPTER_MAP = Symbol('JOB_TO_CHAPTER_MAP');

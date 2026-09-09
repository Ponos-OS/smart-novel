import { Injectable } from '@nestjs/common';

import { IJobToChapterMap } from '../interfaces';

/**
 * @description
 * In-memory implementation of {@link IJobToChapterMap}. Losing this map on a process
 * restart is an accepted, unhandled edge case — swap for a persistent-database-backed
 * implementation later by rebinding the `JOB_TO_CHAPTER_MAP` token, no caller changes needed.
 */
@Injectable()
export class InMemoryJobToChapterMap implements IJobToChapterMap {
  private readonly map = new Map<string, string>();

  set(jobId: string, chapterId: string): void {
    this.map.set(jobId, chapterId);
  }

  get(jobId: string): string | undefined {
    return this.map.get(jobId);
  }
}

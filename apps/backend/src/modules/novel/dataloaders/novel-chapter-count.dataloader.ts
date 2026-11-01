import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';

import { NovelService } from '../services';

@Injectable({ scope: Scope.REQUEST })
export class NovelChapterCountDataLoader {
  private readonly loader: DataLoader<string, number>;

  constructor(novelService: NovelService) {
    this.loader = new DataLoader<string, number>(async (ids) => {
      const counts = await novelService.estimateChapterCounts([
        ...ids,
      ]);

      return ids.map((id) => counts.get(id) ?? 0);
    });
  }

  load(novelId: string): Promise<number> {
    return this.loader.load(novelId);
  }
}

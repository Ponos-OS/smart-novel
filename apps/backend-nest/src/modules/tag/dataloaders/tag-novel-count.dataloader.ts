import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';

import { TagService } from '../services';

@Injectable({ scope: Scope.REQUEST })
export class TagNovelCountDataLoader {
  private readonly loader: DataLoader<string, number>;

  constructor(tagService: TagService) {
    this.loader = new DataLoader<string, number>(async (ids) => {
      const counts = await tagService.estimateNovelCounts([...ids]);

      return ids.map((id) => counts.get(id) ?? 0);
    });
  }

  load(tagId: string): Promise<number> {
    return this.loader.load(tagId);
  }
}

import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';

import { CategoryService } from '../services';

@Injectable({ scope: Scope.REQUEST })
export class CategoryNovelCountDataLoader {
  private readonly loader: DataLoader<string, number>;

  constructor(categoryService: CategoryService) {
    this.loader = new DataLoader<string, number>(async (ids) => {
      const counts = await categoryService.estimateNovelCounts([
        ...ids,
      ]);

      return ids.map((id) => counts.get(id) ?? 0);
    });
  }

  load(categoryId: string): Promise<number> {
    return this.loader.load(categoryId);
  }
}

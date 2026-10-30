import { Module } from '@nestjs/common';

import { CategoryFieldResolver } from './category.field-resolver';
import { CategoryResolver } from './category.resolver';
import { CategoryNovelCountDataLoader } from './dataloaders';
import { CategoryService } from './services';

@Module({
  providers: [
    CategoryResolver,
    CategoryFieldResolver,
    CategoryService,
    CategoryNovelCountDataLoader,
  ],
})
export class CategoryModule {}

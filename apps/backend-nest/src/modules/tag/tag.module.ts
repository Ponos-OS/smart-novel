import { Module } from '@nestjs/common';

import { TagNovelCountDataLoader } from './dataloaders';
import { TagService } from './services';
import { TagFieldResolver } from './tag.field-resolver';
import { TagResolver } from './tag.resolver';

@Module({
  providers: [
    TagResolver,
    TagFieldResolver,
    TagService,
    TagNovelCountDataLoader,
  ],
})
export class TagModule {}

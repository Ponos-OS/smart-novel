import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { isAdmin } from '@smart-novel/shared';

import {
  CurrentUserOptional,
  type IAuthUser,
  Public,
} from '../../auth';
import { NovelWriter } from '../../writer';
import { NovelWriterDataLoader } from '../dataloaders';
import { Novel } from '../types';

@Public()
@Resolver(() => Novel)
export class NovelWriterFieldResolver {
  constructor(
    private readonly novelWriterDataLoader: NovelWriterDataLoader,
  ) {}

  @ResolveField(() => NovelWriter, {
    nullable: true,
    description:
      'Who wrote the novel. Everybody sees the pen name of an approved writer; the real name, email and applications are for admins only, who also see a writer that is not approved.',
  })
  writer(
    @Parent() novel: Novel,
    @CurrentUserOptional() user?: IAuthUser,
  ): Promise<NovelWriter | null> {
    return this.novelWriterDataLoader.load(
      { novelId: novel.id, writerId: novel.writerId },
      isAdmin(user?.roles ?? []),
    );
  }
}

import {
  Args,
  ID,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { Role } from '@smart-novel/shared';
import { isNil } from 'nestjs-backend-common';

import { ParseUuidPipe } from '../../../shared';
import {
  CheckPolicy,
  CurrentUser,
  CurrentUserOptional,
  type IAuthUser,
  Public,
} from '../../auth';
import { RequireAcceptedTerms } from '../../platform-terms';
import { NovelAction } from '../enums';
import {
  ChapterFiltersInput,
  ChapterOrderByInput,
  CreateNovelInput,
  NovelFiltersInput,
  UpdateNovelInput,
} from '../inputs';
import {
  CoverContentLengthPipe,
  CoverContentTypePipe,
} from '../pipes';
import { NovelCoverService, NovelService } from '../services';
import {
  Chapter,
  ChapterConnection,
  DeleteNovelResponse,
  Novel,
  NovelConnection,
  NovelCoverUploadUrl,
} from '../types';

@Resolver(() => Novel)
export class NovelResolver {
  constructor(
    private readonly novelService: NovelService,
    private readonly novelCoverService: NovelCoverService,
  ) {}

  @Public()
  @Query(() => Novel, { description: 'Find a novel by its ID' })
  async novel(
    @Args(
      'id',
      {
        type: () => ID,
        description: 'The ID of the novel',
      },
      ParseUuidPipe,
    )
    id: string,
  ): Promise<Novel> {
    const novel = await this.novelService.findOne(id);

    return novel;
  }

  @Public()
  @Query(() => NovelConnection, {
    description: 'Paginated list of novels',
  })
  async novelsConnection(
    @Args('first', { type: () => Int, nullable: true })
    first?: number,
    @Args('last', { type: () => Int, nullable: true }) last?: number,
    @Args('after', { type: () => String, nullable: true })
    after?: string,
    @Args('before', { type: () => String, nullable: true })
    before?: string,
    @Args('filters', {
      type: () => NovelFiltersInput,
      nullable: true,
    })
    filters?: NovelFiltersInput,
  ): Promise<NovelConnection> {
    return this.novelService.findNovelsConnection(
      first,
      last,
      after,
      before,
      filters,
    );
  }

  @RequireAcceptedTerms()
  @CheckPolicy('novel', 'create')
  @Mutation(() => Novel, {
    description:
      'Create a novel owned by the caller. Categories must already be approved.',
  })
  async createNovel(
    @Args('input', {
      type: () => CreateNovelInput,
      description: 'The new novel',
    })
    input: CreateNovelInput,
    @CurrentUser() user: IAuthUser,
  ): Promise<Novel> {
    return this.novelService.createNovel(
      user.sub,
      `${user.givenName} ${user.familyName}`.trim(),
      input,
    );
  }

  @RequireAcceptedTerms()
  @CheckPolicy('novel', 'update')
  @Mutation(() => Novel, {
    description:
      'Update a novel. Only the passed fields change; passed categories replace the current ones.',
  })
  async updateNovel(
    @Args(
      'id',
      { type: () => ID, description: 'The ID of the novel' },
      ParseUuidPipe,
    )
    id: string,
    @Args('input', {
      type: () => UpdateNovelInput,
      description: 'The fields to change',
    })
    input: UpdateNovelInput,
  ): Promise<Novel> {
    return this.novelService.updateNovel(id, input);
  }

  @RequireAcceptedTerms()
  @CheckPolicy('novel', 'update', 'novelId')
  @Mutation(() => NovelCoverUploadUrl, {
    description:
      'First step of a cover change: get a presigned URL to PUT the image to. Allowed types are image/jpeg, image/png and image/webp, up to 5 MB. Call `setNovelCover` once the upload succeeded.',
  })
  async createNovelCoverUploadUrl(
    @Args(
      'novelId',
      { type: () => ID, description: 'The ID of the novel' },
      ParseUuidPipe,
    )
    novelId: string,
    @Args(
      'contentType',
      {
        type: () => String,
        description: 'MIME type of the image',
      },
      CoverContentTypePipe,
    )
    contentType: string,
    @Args(
      'contentLength',
      {
        type: () => Int,
        description: 'Size of the image in bytes',
      },
      CoverContentLengthPipe,
    )
    contentLength: number,
  ): Promise<NovelCoverUploadUrl> {
    return this.novelCoverService.createUploadUrl(
      novelId,
      contentType,
      contentLength,
    );
  }

  @RequireAcceptedTerms()
  @CheckPolicy('novel', 'update', 'novelId')
  @Mutation(() => Novel, {
    description:
      'Second step of a cover change: make the uploaded object the novel cover. The previous cover is removed from the bucket.',
  })
  async setNovelCover(
    @Args(
      'novelId',
      { type: () => ID, description: 'The ID of the novel' },
      ParseUuidPipe,
    )
    novelId: string,
    @Args('objectKey', {
      type: () => String,
      description: 'The key returned by `createNovelCoverUploadUrl`',
    })
    objectKey: string,
  ): Promise<Novel> {
    return this.novelCoverService.setCover(novelId, objectKey);
  }

  @CheckPolicy('novel', 'delete')
  @Mutation(() => DeleteNovelResponse, {
    description:
      'Permanently delete a novel with its chapters, contents, read history, narration audio and cover.',
  })
  async deleteNovel(
    @Args(
      'id',
      { type: () => ID, description: 'The ID of the novel' },
      ParseUuidPipe,
    )
    id: string,
  ): Promise<DeleteNovelResponse> {
    return this.novelService.deleteNovel(id);
  }

  @ResolveField(() => [NovelAction], {
    description:
      'Actions the current user is allowed to perform on this novel',
  })
  allowedActions(
    @Parent() novel: Novel,
    @CurrentUserOptional() user?: IAuthUser,
  ): NovelAction[] {
    if (isNil(user)) {
      return [];
    }

    const isOwner = novel.ownerId === user.sub;
    const isAdmin = user.roles.includes(Role.admin);

    if (isOwner || isAdmin) {
      return [NovelAction.MANAGE_TTS, NovelAction.EDIT_CONTENT];
    }

    return [];
  }

  @ResolveField(() => ChapterConnection, {
    description: 'Paginated list of chapters for this novel',
  })
  async chaptersConnection(
    @Parent() novel: Novel,
    @Args('first', { type: () => Int, nullable: true })
    first?: number,
    @Args('last', { type: () => Int, nullable: true })
    last?: number,
    @Args('after', { type: () => String, nullable: true })
    after?: string,
    @Args('before', { type: () => String, nullable: true })
    before?: string,
    @Args('orderBy', {
      type: () => ChapterOrderByInput,
      nullable: true,
    })
    orderBy?: ChapterOrderByInput,
    @Args('filters', {
      type: () => ChapterFiltersInput,
      nullable: true,
    })
    filters?: ChapterFiltersInput,
  ): Promise<ChapterConnection> {
    return this.novelService.getChaptersConnection(
      novel.id,
      first,
      last,
      after,
      before,
      orderBy,
      filters,
    );
  }

  @ResolveField(() => Chapter, {
    nullable: true,
    description: 'Chapter of the novel',
  })
  async chapter(
    @Parent() novel: Novel,
    @Args(
      'id',
      {
        type: () => ID,
        description: 'The ID of the chapter',
      },
      ParseUuidPipe,
    )
    id: string,
  ): Promise<Chapter | null> {
    return this.novelService.getChapter(novel.id, id);
  }

  @ResolveField(() => String, {
    nullable: true,
    description:
      'ISO date string of when the last chapter was published',
  })
  async lastChapterPublishedAt(
    @Parent() novel: Novel,
  ): Promise<string | null> {
    const lastChapter = await this.novelService.getLastChapter(
      novel.id,
    );

    return lastChapter ? lastChapter.updatedAt : null;
  }

  @ResolveField(() => Chapter, {
    nullable: true,
    description: 'The most recently published chapter',
  })
  async lastPublishedChapter(
    @Parent() novel: Novel,
  ): Promise<Chapter | null> {
    return this.novelService.getLastChapter(novel.id);
  }

  @ResolveField(() => Chapter, {
    nullable: true,
    description: 'The first chapter of the novel',
  })
  async firstChapter(
    @Parent() novel: Novel,
  ): Promise<Chapter | null> {
    return this.novelService.getFirstChapter(novel.id);
  }
}

import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { OrderDirection, paginateConnection } from '../../../shared';
import { LicenseService } from '../../license';
import { ChapterOrderField } from '../enums';
import {
  ChapterFiltersInput,
  ChapterOrderByInput,
  CreateNovelInput,
  NovelFiltersInput,
  UpdateNovelInput,
} from '../inputs';
import {
  CHAPTER_REPOSITORY,
  type FindNovelsPageArgs,
  type IChapterRepository,
  type INovelRepository,
  NOVEL_REPOSITORY,
} from '../interfaces';
import {
  Chapter,
  ChapterConnection,
  Novel,
  NovelConnection,
} from '../types';
import { ChapterNarrationService } from './chapter-narration.service';

@Injectable()
export class NovelService {
  constructor(
    @Inject(NOVEL_REPOSITORY)
    private readonly novelRepository: INovelRepository,
    @Inject(CHAPTER_REPOSITORY)
    private readonly chapterRepository: IChapterRepository,
    private readonly chapterNarrationService: ChapterNarrationService,
    private readonly licenseService: LicenseService,
  ) {}

  async findOne(id: string): Promise<Novel> {
    const novel = await this.novelRepository.findById(id);

    if (!novel) {
      throw new NotFoundException(`Novel with id ${id} not found`);
    }

    return novel;
  }

  async createNovel(
    ownerId: string,
    author: string,
    input: CreateNovelInput,
  ): Promise<Novel> {
    const { licenseId, licenseDraft, ...fields } = input;
    const license =
      (await this.licenseService.resolve(
        { licenseId, licenseDraft },
        ownerId,
      )) ?? (await this.licenseService.getDefault());

    return this.novelRepository.createNovel({
      ownerId,
      author,
      ...fields,
      licenseId: license.id,
    });
  }

  async updateNovel(
    id: string,
    input: UpdateNovelInput,
  ): Promise<Novel> {
    const novel = await this.findOne(id);

    const { licenseId, licenseDraft, ...fields } = input;
    const license = await this.licenseService.resolve(
      { licenseId, licenseDraft },
      novel.ownerId,
    );

    return this.novelRepository.updateNovel(id, {
      ...fields,
      licenseId: license?.id,
    });
  }

  async deleteNovel(id: string): Promise<{ id: string }> {
    const deleted = await this.novelRepository.deleteNovel(id);

    if (!deleted) {
      throw new NotFoundException(`Novel with id ${id} not found`);
    }

    const urls = [
      ...deleted.narrationUrls,
      ...(deleted.coverUrl ? [deleted.coverUrl] : []),
    ];

    // `deleteAudio` never throws, so one failed object does not stop the others.
    await Promise.all(
      urls.map((url) =>
        this.chapterNarrationService.deleteAudio(url),
      ),
    );

    return { id };
  }

  async findNovelsConnection(
    first?: number,
    last?: number,
    after?: string,
    before?: string,
    filters?: NovelFiltersInput,
  ): Promise<NovelConnection> {
    const connectionFilters: FindNovelsPageArgs['filters'] = {
      categoryIn: filters?.category?.in,
      categoryNin: filters?.category?.nin,
    };
    const { edges, pageInfo } = await paginateConnection({
      pagination: { first, last, after, before },
      findMany: (page) =>
        this.novelRepository.findNovelsPage({
          page,
          filters: connectionFilters,
        }),
      toNode: (novel) => novel,
    });

    const connection = Object.assign(new NovelConnection(), {
      edges,
      pageInfo,
    });
    connection._filterContext = connectionFilters;

    return connection;
  }

  async getChaptersConnection(
    novelId: string,
    first?: number,
    last?: number,
    after?: string,
    before?: string,
    orderBy?: ChapterOrderByInput,
    filters?: ChapterFiltersInput,
  ): Promise<ChapterConnection> {
    const orderByField =
      orderBy?.field ?? ChapterOrderField.CHAPTER_NUMBER;
    const orderByDirection = orderBy?.direction ?? OrderDirection.ASC;
    const connectionFilters = {
      narrationStatus: filters?.narrationStatus?.eq,
    };
    const { edges, pageInfo } = await paginateConnection({
      pagination: { first, last, after, before },
      findMany: (page) =>
        this.chapterRepository.findChaptersPage({
          novelId,
          page,
          orderByField,
          orderByDirection,
          filters: connectionFilters,
        }),
      toNode: (chapter) => chapter as Chapter,
    });

    const connection = Object.assign(new ChapterConnection(), {
      edges,
      pageInfo,
    });
    connection._filterContext = {
      novelId,
      filters: connectionFilters,
    };

    return connection;
  }

  async getChapter(
    novelId: string,
    chapterId: string,
  ): Promise<Chapter | null> {
    return this.chapterRepository.getChapter(novelId, chapterId);
  }

  async getFirstChapter(novelId: string): Promise<Chapter | null> {
    return this.chapterRepository.getFirstChapter(novelId);
  }

  async getLastChapter(novelId: string): Promise<Chapter | null> {
    return this.chapterRepository.getLastChapter(novelId);
  }
}

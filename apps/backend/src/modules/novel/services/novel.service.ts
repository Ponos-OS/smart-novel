import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PageInfo } from 'nestjs-backend-common';

import { OrderDirection } from '../../../shared';
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
  type FindNovelsConnectionArgs,
  type IChapterRepository,
  type INovelRepository,
  NOVEL_REPOSITORY,
} from '../interfaces';
import {
  Chapter,
  ChapterConnection,
  ChapterEdge,
  Novel,
  NovelConnection,
  NovelEdge,
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
    input: CreateNovelInput,
  ): Promise<Novel> {
    return this.novelRepository.createNovel({ ownerId, ...input });
  }

  async updateNovel(
    id: string,
    input: UpdateNovelInput,
  ): Promise<Novel> {
    await this.findOne(id);

    return this.novelRepository.updateNovel(id, input);
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
    const connectionFilters: FindNovelsConnectionArgs['filters'] = {
      categoryIn: filters?.category?.in,
      categoryNin: filters?.category?.nin,
    };
    const { items: novels, hasMore } =
      await this.novelRepository.findNovelsConnection({
        pagination: { first, last, after, before },
        filters: connectionFilters,
      });
    const edges: NovelEdge[] = novels.map((novel) => ({
      cursor: Buffer.from(novel.id).toString('base64'),
      node: novel,
    }));

    const pageInfo: PageInfo = {
      startCursor: edges.length > 0 ? edges[0].cursor : null,
      endCursor:
        edges.length > 0 ? edges[edges.length - 1].cursor : null,
      hasPreviousPage: !!after,
      hasNextPage: hasMore && !!first,
    };

    const connection = new NovelConnection();
    connection.edges = edges;
    connection.pageInfo = pageInfo;
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
    const { items: chapters, hasMore } =
      await this.chapterRepository.findChaptersConnection({
        novelId,
        pagination: { first, last, after, before },
        orderByField,
        orderByDirection,
        filters: connectionFilters,
      });

    const edges: ChapterEdge[] = chapters.map((chapter) => ({
      cursor: Buffer.from(chapter.id).toString('base64'),
      node: chapter as Chapter,
    }));

    const pageInfo: PageInfo = {
      startCursor: edges.length > 0 ? edges[0].cursor : null,
      endCursor:
        edges.length > 0 ? edges[edges.length - 1].cursor : null,
      hasPreviousPage: !!after,
      hasNextPage: hasMore && !!first,
    };

    const connection = new ChapterConnection();
    connection.edges = edges;
    connection.pageInfo = pageInfo;
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

  async getCategories(): Promise<string[]> {
    return this.novelRepository.getCategories();
  }
}

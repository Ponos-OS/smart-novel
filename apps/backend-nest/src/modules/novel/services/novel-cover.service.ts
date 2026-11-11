import type { ConfigType } from '@nestjs/config';

import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  COVER_CONTENT_TYPE_EXTENSIONS,
  COVER_MAX_SIZE_BYTES,
} from '@smart-novel/shared';
import { urlBuilder } from 'nestjs-backend-common';
import { randomUUID } from 'node:crypto';

import { appConfigs } from '../../../app/configs/app.config';
import { ObjectStorageService } from '../../object-storage';
import { COVER_OBJECT_KEY_PREFIX } from '../constants';
import {
  type INovelRepository,
  NOVEL_REPOSITORY,
} from '../interfaces';
import { Novel, NovelCoverUploadUrl } from '../types';
import { ChapterNarrationService } from './chapter-narration.service';

@Injectable()
export class NovelCoverService {
  private static readonly UPLOAD_URL_TTL_SECONDS = 5 * 60;

  constructor(
    @Inject(NOVEL_REPOSITORY)
    private readonly novelRepository: INovelRepository,
    private readonly objectStorageService: ObjectStorageService,
    private readonly chapterNarrationService: ChapterNarrationService,
    @Inject(appConfigs.KEY)
    private readonly appConfig: ConfigType<typeof appConfigs>,
  ) {}

  async createUploadUrl(
    novelId: string,
    contentType: string,
    contentLength: number,
  ): Promise<NovelCoverUploadUrl> {
    await this.findNovel(novelId);

    // `contentType` and `contentLength` are already validated by the resolver's pipes.
    const extension = COVER_CONTENT_TYPE_EXTENSIONS[contentType];
    // The key is ours, never the client's, so an upload can only land under this novel's prefix.
    const objectKey = `${COVER_OBJECT_KEY_PREFIX}/${novelId}/${randomUUID()}.${extension}`;
    const uploadUrl =
      await this.objectStorageService.generateBrowserUploadUrl(
        this.appConfig.OBJECT_STORAGE_BUCKET,
        objectKey,
        contentType,
        NovelCoverService.UPLOAD_URL_TTL_SECONDS,
        contentLength,
      );

    return { uploadUrl, objectKey };
  }

  async setCover(novelId: string, objectKey: string): Promise<Novel> {
    await this.findNovel(novelId);

    if (!this.isCoverKeyOf(novelId, objectKey)) {
      throw new BadRequestException(
        'The object key is not an upload URL key of this novel',
      );
    }

    const metadata = await this.objectStorageService.head(
      this.appConfig.OBJECT_STORAGE_BUCKET,
      objectKey,
    );

    if (!metadata) {
      throw new BadRequestException(
        'Nothing was uploaded to this key',
      );
    }

    if (
      !metadata.contentType ||
      !Object.hasOwn(
        COVER_CONTENT_TYPE_EXTENSIONS,
        metadata.contentType,
      ) ||
      !metadata.contentLength ||
      metadata.contentLength > COVER_MAX_SIZE_BYTES
    ) {
      throw new BadRequestException(
        'The uploaded file is not an allowed cover type or is too large',
      );
    }

    const coverUrl = urlBuilder(
      this.appConfig.OBJECT_STORAGE_PUBLIC_URL,
      this.appConfig.OBJECT_STORAGE_BUCKET,
      objectKey,
    );
    const { novel, previousCoverUrl } =
      await this.novelRepository.setCoverUrl(novelId, coverUrl);

    if (previousCoverUrl && previousCoverUrl !== coverUrl) {
      await this.chapterNarrationService.deleteAudio(
        previousCoverUrl,
      );
    }

    return novel;
  }

  private isCoverKeyOf(novelId: string, objectKey: string): boolean {
    const extensions = Object.values(
      COVER_CONTENT_TYPE_EXTENSIONS,
    ).join('|');
    const pattern = new RegExp(
      `^${COVER_OBJECT_KEY_PREFIX}/${novelId}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(${extensions})$`,
    );

    return pattern.test(objectKey);
  }

  private async findNovel(novelId: string): Promise<void> {
    const novel = await this.novelRepository.findById(novelId);

    if (!novel) {
      throw new NotFoundException(
        `Novel with id ${novelId} not found`,
      );
    }
  }
}

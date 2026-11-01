import { Module } from '@nestjs/common';

import { LicenseModule } from '../license';
import { WriterModule } from '../writer';
import {
  ChapterContentDataLoader,
  ChapterNavigationDataLoader,
  ChapterViewerStateDataLoader,
  NovelChapterCountDataLoader,
  NovelWriterDataLoader,
} from './dataloaders';
import {
  CHAPTER_CONTENT_REPOSITORY,
  CHAPTER_REPOSITORY,
  CHAPTER_USER_STATE_REPOSITORY,
  NOVEL_REPOSITORY,
} from './interfaces';
import { PubSubProvider } from './providers';
import {
  PrismaChapterContentRepository,
  PrismaChapterRepository,
  PrismaChapterUserStateRepository,
  PrismaNovelRepository,
} from './repositories';
import {
  ChapterConnectionFieldResolver,
  ChapterFieldResolver,
  ChapterNarrationResolver,
  ChapterResolver,
  ChapterUserStateResolver,
  NovelChapterCountFieldResolver,
  NovelLicenseFieldResolver,
  NovelResolver,
  NovelWriterFieldResolver,
} from './resolvers';
import {
  ChapterNarrationService,
  ChapterService,
  ChapterUserStateService,
  NarrationLockService,
  NovelCoverService,
  NovelService,
  TtsTextService,
} from './services';

@Module({
  imports: [LicenseModule, WriterModule],
  providers: [
    NovelResolver,
    NovelChapterCountFieldResolver,
    NovelLicenseFieldResolver,
    NovelWriterFieldResolver,
    ChapterFieldResolver,
    ChapterNarrationResolver,
    ChapterResolver,
    ChapterUserStateResolver,
    ChapterConnectionFieldResolver,
    NovelService,
    NovelCoverService,
    ChapterService,
    ChapterNarrationService,
    ChapterUserStateService,
    NarrationLockService,
    PrismaNovelRepository,
    PrismaChapterContentRepository,
    PrismaChapterUserStateRepository,
    ChapterContentDataLoader,
    ChapterNavigationDataLoader,
    ChapterViewerStateDataLoader,
    NovelWriterDataLoader,
    NovelChapterCountDataLoader,
    PubSubProvider,
    TtsTextService,
    {
      provide: NOVEL_REPOSITORY,
      useClass: PrismaNovelRepository,
    },
    {
      provide: CHAPTER_REPOSITORY,
      useClass: PrismaChapterRepository,
    },
    {
      provide: CHAPTER_CONTENT_REPOSITORY,
      useClass: PrismaChapterContentRepository,
    },
    {
      provide: CHAPTER_USER_STATE_REPOSITORY,
      useClass: PrismaChapterUserStateRepository,
    },
  ],
})
export class NovelModule {}

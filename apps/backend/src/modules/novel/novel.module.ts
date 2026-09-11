import { Module } from '@nestjs/common';

import {
  ChapterContentDataLoader,
  ChapterNavigationDataLoader,
  ChapterViewerStateDataLoader,
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
  NovelConnectionFieldResolver,
  NovelResolver,
} from './resolvers';
import {
  ChapterNarrationService,
  ChapterService,
  ChapterUserStateService,
  NarrationLockService,
  NovelService,
  TtsTextService,
} from './services';

@Module({
  providers: [
    NovelResolver,
    NovelConnectionFieldResolver,
    ChapterFieldResolver,
    ChapterNarrationResolver,
    ChapterResolver,
    ChapterUserStateResolver,
    ChapterConnectionFieldResolver,
    NovelService,
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

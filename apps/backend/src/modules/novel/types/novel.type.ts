import {
  Field,
  ID,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { NovelState } from '@prisma/client';

import { NovelAction } from '../enums';
import { INovel } from '../interfaces';
import { Chapter } from './chapter.type';

registerEnumType(NovelState, {
  name: 'NovelState',
});

@ObjectType({
  description: 'Represents a novel with its details.',
})
export class Novel implements INovel {
  @Field(() => ID, { description: 'Unique identifier for the novel' })
  id: string;

  @Field({ description: 'The name of the novel' })
  name: string;

  @Field({ description: 'The author of the novel' })
  author: string;

  @Field(() => [String], {
    description: 'The categories of the novel',
  })
  category: string[];

  @Field(() => NovelState, { description: 'The state of the novel' })
  state: NovelState;

  @Field(() => String, {
    nullable: true,
    description: 'URL to the novel cover image',
  })
  coverUrl?: string;

  @Field(() => String, {
    description: 'A short description of the novel',
  })
  description: string;

  /**
   * @internal field — not exposed in the GraphQL schema. Used by the `allowedActions` field resolver to determine ownership.
   * @example "233104087965432001"
   */
  ownerId: string;

  /**
   * @internal field — not exposed in the GraphQL schema. Used by the `license` field resolver.
   */
  licenseId: string;

  @Field(() => [NovelAction], {
    description:
      'Actions the current user is allowed to perform on this novel',
  })
  allowedActions?: NovelAction[];

  @Field(() => Chapter, {
    nullable: true,
    description: 'The current chapter of the novel',
  })
  chapter?: Chapter;

  @Field(() => String, {
    nullable: true,
    description:
      'ISO date string of when the last chapter was published',
  })
  lastChapterPublishedAt?: string;

  @Field(() => Chapter, {
    nullable: true,
    description: 'The most recently published chapter',
  })
  lastPublishedChapter?: Chapter;

  @Field(() => Chapter, {
    nullable: true,
    description: 'The first chapter of the novel',
  })
  firstChapter?: Chapter;
}

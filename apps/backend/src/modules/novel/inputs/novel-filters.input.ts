import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { NovelState } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

import { ListFilterInputMixin } from '../../../shared';
import { IsNotLessThan } from './is-not-less-than.decorator';

export const NOVEL_OWNER_IDS_MAX_SIZE = 100;

/** @description PostgreSQL text cannot hold a NUL character, so it would fail the query as a 500. */
// eslint-disable-next-line no-control-regex -- the NUL character is exactly what is refused
const NO_NUL_CHARACTER = /^[^\u0000]*$/;
const NO_NUL_MESSAGE = 'tag names cannot contain a NUL character';

@InputType()
export class TagFilterInput extends ListFilterInputMixin<string>(
  () => String,
) {
  @Transform(({ value }) => value.map((v: string) => v.toLowerCase()))
  @Matches(NO_NUL_CHARACTER, { each: true, message: NO_NUL_MESSAGE })
  override in?: string[];

  @Transform(({ value }) => value.map((v: string) => v.toLowerCase()))
  @Matches(NO_NUL_CHARACTER, { each: true, message: NO_NUL_MESSAGE })
  override nin?: string[];
}

@InputType()
export class ChapterCountRangeInput {
  @Field(() => Int, {
    nullable: true,
    description: 'At least this many chapters',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  min?: number;

  @Field(() => Int, {
    nullable: true,
    description: 'At most this many chapters',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @IsNotLessThan('min')
  max?: number;
}

@InputType()
export class DateRangeInput {
  @Field(() => Date, { nullable: true, description: 'Inclusive' })
  @IsOptional()
  @IsDate()
  from?: Date;

  @Field(() => Date, { nullable: true, description: 'Inclusive' })
  @IsOptional()
  @IsDate()
  @IsNotLessThan('from')
  to?: Date;
}

@InputType()
export class NovelFiltersInput {
  @Field(() => TagFilterInput, {
    nullable: true,
    description: 'Filter by tag',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TagFilterInput)
  tags?: TagFilterInput;

  @Field(() => ChapterCountRangeInput, {
    nullable: true,
    description:
      'The exact number of chapters, not the estimate `estimatedChapterCount` shows',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ChapterCountRangeInput)
  chapterCount?: ChapterCountRangeInput;

  @Field(() => DateRangeInput, {
    nullable: true,
    description:
      'When the first chapter was created. Novels without a chapter are left out once a bound is given.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DateRangeInput)
  firstChapterCreatedAt?: DateRangeInput;

  @Field(() => NovelState, { nullable: true })
  @IsOptional()
  @IsEnum(NovelState)
  state?: NovelState;

  @Field(() => [ID], {
    nullable: true,
    description: `The novels of these writers, by the \`userId\` of the writer. At most ${NOVEL_OWNER_IDS_MAX_SIZE}; an empty list means no filter.`,
  })
  @IsOptional()
  @ArrayMaxSize(NOVEL_OWNER_IDS_MAX_SIZE)
  @Matches(/^\d{1,32}$/, {
    each: true,
    message: 'ownerIds must be user IDs',
  })
  ownerIds?: string[];
}

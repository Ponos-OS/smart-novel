import { Field, InputType } from '@nestjs/graphql';
import { NovelState } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

import { normalizeCategoryNames } from '../utils';

@InputType()
export class UpdateNovelInput {
  @Field(() => String, { nullable: true, description: 'Novel name' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  name?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Novel author',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  author?: string;

  @Field(() => String, {
    nullable: true,
    description: 'A short description',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  description?: string;

  @Field(() => NovelState, { nullable: true })
  @IsOptional()
  @IsEnum(NovelState)
  state?: NovelState;

  @Field(() => [String], {
    nullable: true,
    description:
      'Replaces the current categories; omit to keep them. Created when missing.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @Transform(({ value }) => normalizeCategoryNames(value))
  categories?: string[];
}

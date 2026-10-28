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
export class CreateNovelInput {
  @Field(() => String, { description: 'Novel name' })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  name!: string;

  @Field(() => String, { description: 'Novel author' })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  author!: string;

  @Field(() => String, { description: 'A short description' })
  @IsString()
  @Transform(({ value }) => value?.trim())
  description!: string;

  @Field(() => NovelState, {
    nullable: true,
    description: 'Defaults to ONGOING',
  })
  @IsOptional()
  @IsEnum(NovelState)
  state?: NovelState;

  @Field(() => [String], {
    nullable: true,
    description:
      'Category names, created when missing. Compared case-insensitively.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @Transform(({ value }) => normalizeCategoryNames(value))
  categories?: string[];
}

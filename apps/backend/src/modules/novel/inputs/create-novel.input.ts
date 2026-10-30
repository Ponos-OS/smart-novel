import { Field, ID, InputType } from '@nestjs/graphql';
import { NovelState } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

import { LicenseDraftInput } from '../../license/inputs';
import { normalizeCategoryNames } from '../utils';

@InputType()
export class CreateNovelInput {
  @Field(() => String, { description: 'Novel name' })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  name!: string;

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

  @Field(() => ID, {
    nullable: true,
    description:
      'An existing license. Exclusive with `licenseDraft`. Omit both to get the default license.',
  })
  @IsOptional()
  @IsUUID()
  licenseId?: string;

  @Field(() => LicenseDraftInput, {
    nullable: true,
    description:
      'A license text to store, or reuse when already stored. Exclusive with `licenseId`.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LicenseDraftInput)
  licenseDraft?: LicenseDraftInput;
}

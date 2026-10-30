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
export class UpdateNovelInput {
  @Field(() => String, { nullable: true, description: 'Novel name' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  name?: string;

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
      'Replaces the current categories; omit to keep them. Names must be approved categories.',
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
      'An existing license. Exclusive with `licenseDraft`. Omit both to keep the current license.',
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

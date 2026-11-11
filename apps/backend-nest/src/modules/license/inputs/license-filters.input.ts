import { Field, InputType } from '@nestjs/graphql';
import { LICENSE_SEARCH_MAX_LENGTH } from '@smart-novel/shared';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { LicenseScope } from '../types/license.type';

@InputType()
export class LicenseFiltersInput {
  @Field(() => LicenseScope, {
    nullable: true,
    description: 'Omit to get every scope the caller may see',
  })
  @IsOptional()
  @IsEnum(LicenseScope)
  scope?: LicenseScope;

  @Field(() => String, {
    nullable: true,
    description:
      'Licenses whose name contains this text, case-insensitively. Blank is ignored.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(LICENSE_SEARCH_MAX_LENGTH)
  @Transform(({ value }) => value?.trim())
  search?: string;
}

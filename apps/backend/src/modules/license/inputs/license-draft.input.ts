import { Field, InputType } from '@nestjs/graphql';
import { LicenseSourceType } from '@prisma/client';
import {
  LICENSE_NAME_MAX_LENGTH,
  LICENSE_TEXT_MAX_LENGTH,
} from '@smart-novel/shared';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

@InputType()
export class LicenseDraftSourceInput {
  @Field(() => LicenseSourceType)
  @IsEnum(LicenseSourceType)
  type!: LicenseSourceType;

  @Field(() => String, {
    nullable: true,
    description: 'Required for FORKED, must be omitted for CUSTOM',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  canonicalId?: string;
}

@InputType({
  description:
    'A license text the author picked or wrote. Stored once per distinct text.',
})
export class LicenseDraftInput {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  @MaxLength(LICENSE_NAME_MAX_LENGTH)
  @Transform(({ value }) => value?.trim())
  title!: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  @MaxLength(LICENSE_TEXT_MAX_LENGTH)
  text!: string;

  @Field(() => LicenseDraftSourceInput)
  @ValidateNested()
  @Type(() => LicenseDraftSourceInput)
  source!: LicenseDraftSourceInput;
}

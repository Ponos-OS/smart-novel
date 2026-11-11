import { Field, ID, InputType } from '@nestjs/graphql';
import {
  LICENSE_NAME_MAX_LENGTH,
  LICENSE_TEXT_MAX_LENGTH,
} from '@smart-novel/shared';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { LicenseDraftSourceInput } from './license-draft.input';

@InputType()
export class CreateLicenseDraftInput {
  @Field(() => ID, {
    nullable: true,
    description:
      'Start from the text of this license. Exclusive with `canonicalId`. Omit both to start from nothing.',
  })
  @IsOptional()
  @IsUUID()
  licenseId?: string;

  @Field(() => ID, {
    nullable: true,
    description:
      'Start from the text of this canonical license of the registry, e.g. "CC-BY-NC-4.0".',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  canonicalId?: string;
}

@InputType({
  description:
    'The whole draft, as the writer has it. A draft may be empty or inconsistent while it is being written; finalizing checks it.',
})
export class SaveLicenseDraftInput {
  @Field(() => ID)
  @IsUUID()
  id!: string;

  @Field(() => String)
  @IsString()
  @MaxLength(LICENSE_NAME_MAX_LENGTH)
  title!: string;

  @Field(() => String)
  @IsString()
  @MaxLength(LICENSE_TEXT_MAX_LENGTH)
  text!: string;

  @Field(() => LicenseDraftSourceInput)
  @ValidateNested()
  @Type(() => LicenseDraftSourceInput)
  source!: LicenseDraftSourceInput;
}

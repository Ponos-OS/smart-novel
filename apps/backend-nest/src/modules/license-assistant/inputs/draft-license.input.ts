import { Field, InputType } from '@nestjs/graphql';
import {
  LICENSE_ASSISTANT_MAX_TURNS,
  LICENSE_ASSISTANT_MESSAGE_MAX_LENGTH,
  LICENSE_ASSISTANT_TURN_MAX_LENGTH,
} from '@smart-novel/shared';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { LicenseDraftInput } from '../../license';
import { LicenseAssistantMessageRole } from '../types';

@InputType()
export class LicenseAssistantPreferencesInput {
  @Field(() => String, {
    nullable: true,
    description: 'A canonical license category to prefer',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  category?: string;
}

@InputType({
  description:
    'One turn of the conversation, as the assistant returned it.',
})
export class LicenseAssistantMessageInput {
  @Field(() => LicenseAssistantMessageRole)
  @IsEnum(LicenseAssistantMessageRole)
  role!: LicenseAssistantMessageRole;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  @MaxLength(LICENSE_ASSISTANT_TURN_MAX_LENGTH)
  content!: string;
}

@InputType()
export class DraftLicenseInput {
  @Field(() => [LicenseAssistantMessageInput], {
    defaultValue: [],
    description:
      'The `conversation` of the previous answer, unchanged. Empty to start a new conversation. Nothing is stored here: the client keeps the conversation.',
  })
  @ArrayMaxSize(LICENSE_ASSISTANT_MAX_TURNS)
  @ValidateNested({ each: true })
  @Type(() => LicenseAssistantMessageInput)
  conversation!: LicenseAssistantMessageInput[];

  @Field(() => LicenseDraftInput, {
    nullable: true,
    description:
      'The draft the author is working on, as the client holds it. It may have been edited since the previous answer.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LicenseDraftInput)
  draft?: LicenseDraftInput;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  @MaxLength(LICENSE_ASSISTANT_MESSAGE_MAX_LENGTH)
  @Transform(({ value }) => value?.trim())
  message!: string;

  @Field(() => LicenseAssistantPreferencesInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => LicenseAssistantPreferencesInput)
  preferences?: LicenseAssistantPreferencesInput;
}

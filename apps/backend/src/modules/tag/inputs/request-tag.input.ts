import { Field, InputType } from '@nestjs/graphql';
import { TAG_DESCRIPTION_MAX_LENGTH } from '@smart-novel/shared';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { TAG_NAME_MAX_LENGTH } from '../constants';

@InputType()
export class RequestTagInput {
  @Field(() => String, {
    description: `Trimmed, and unique regardless of case. At most ${TAG_NAME_MAX_LENGTH} characters.`,
  })
  @IsString()
  @IsNotEmpty({ message: 'A tag name cannot be empty' })
  @MaxLength(TAG_NAME_MAX_LENGTH, {
    message: `A tag name can have at most ${TAG_NAME_MAX_LENGTH} characters`,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name!: string;

  @Field(() => String, {
    description: `What the tag is for, trimmed. At most ${TAG_DESCRIPTION_MAX_LENGTH} characters.`,
  })
  @IsString()
  @IsNotEmpty({ message: 'A tag needs a description' })
  @MaxLength(TAG_DESCRIPTION_MAX_LENGTH, {
    message: `A tag description can have at most ${TAG_DESCRIPTION_MAX_LENGTH} characters`,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  description!: string;
}

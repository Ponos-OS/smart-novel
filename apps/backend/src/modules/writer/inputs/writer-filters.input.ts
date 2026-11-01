import { Field, InputType } from '@nestjs/graphql';
import { WriterStatus } from '@prisma/client';
import { WRITER_SEARCH_MAX_LENGTH } from '@smart-novel/shared';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

@InputType()
export class WriterFiltersInput {
  @Field(() => WriterStatus, {
    nullable: true,
    description: 'Defaults to PENDING',
  })
  @IsOptional()
  @IsEnum(WriterStatus)
  status?: WriterStatus;

  @Field(() => String, {
    nullable: true,
    description:
      'Writers whose pen name contains this text, case-insensitively. Blank is ignored.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(WRITER_SEARCH_MAX_LENGTH)
  @Transform(({ value }) => value?.trim())
  search?: string;
}

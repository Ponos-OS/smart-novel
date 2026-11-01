import { Field, InputType } from '@nestjs/graphql';
import { WriterRequestStatus } from '@prisma/client';
import { WRITER_REQUEST_SEARCH_MAX_LENGTH } from '@smart-novel/shared';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

@InputType()
export class WriterRequestFiltersInput {
  @Field(() => WriterRequestStatus, {
    nullable: true,
    description: 'Defaults to PENDING',
  })
  @IsOptional()
  @IsEnum(WriterRequestStatus)
  status?: WriterRequestStatus;

  @Field(() => String, {
    nullable: true,
    description:
      'Requests whose requester name or email contains this text, case-insensitively. Blank is ignored.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(WRITER_REQUEST_SEARCH_MAX_LENGTH)
  @Transform(({ value }) => value?.trim())
  search?: string;
}

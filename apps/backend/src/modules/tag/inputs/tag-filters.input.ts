import { Field, InputType } from '@nestjs/graphql';
import { TagStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

@InputType()
export class TagFiltersInput {
  @Field(() => String, {
    nullable: true,
    description:
      'Tags whose name, or any word in it (after a space or a hyphen), starts with this text, case-insensitively',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  search?: string;

  @Field(() => [TagStatus], {
    nullable: true,
    description:
      'Defaults to [APPROVED]. Only admins can ask for others: [PENDING], or both for every tag. For everybody else it is ignored.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(Object.keys(TagStatus).length)
  @IsEnum(TagStatus, { each: true })
  statuses?: TagStatus[];
}

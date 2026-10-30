import { Field, InputType } from '@nestjs/graphql';
import { CategoryStatus } from '@prisma/client';
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
export class CategoryFiltersInput {
  @Field(() => String, {
    nullable: true,
    description:
      'Categories whose name contains this text, case-insensitively',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  search?: string;

  @Field(() => [CategoryStatus], {
    nullable: true,
    description:
      'Defaults to [APPROVED]. Only admins can ask for others: [PENDING], or both for every category. For everybody else it is ignored.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(Object.keys(CategoryStatus).length)
  @IsEnum(CategoryStatus, { each: true })
  statuses?: CategoryStatus[];
}

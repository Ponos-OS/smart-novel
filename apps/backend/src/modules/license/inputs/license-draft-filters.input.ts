import { Field, InputType } from '@nestjs/graphql';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

@InputType()
export class LicenseDraftFiltersInput {
  @Field(() => [String], {
    nullable: true,
    description:
      "Only the drafts of these writers. A writer may name only themselves, or omit it to get their own; an admin who omits it gets everybody's.",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  ownerIds?: string[];
}

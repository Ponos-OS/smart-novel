import { Field, InputType } from '@nestjs/graphql';
import { NarrationStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';

import { EqualityFilterInputMixin } from '../../../shared';

@InputType({
  description: 'Filter by narration status',
})
export class NarrationStatusFilterInput extends EqualityFilterInputMixin<NarrationStatus>(
  () => NarrationStatus,
) {}

@InputType({
  description: 'Filtering options for chapters',
})
export class ChapterFiltersInput {
  @Field(() => NarrationStatusFilterInput, {
    nullable: true,
    description: 'Filter by narration status',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => NarrationStatusFilterInput)
  narrationStatus?: NarrationStatusFilterInput;
}

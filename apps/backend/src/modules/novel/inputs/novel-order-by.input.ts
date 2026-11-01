import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsOptional } from 'class-validator';

import { OrderDirection } from '../../../shared';
import { NovelOrderField } from '../enums';

@InputType({ description: 'Ordering options for novels' })
export class NovelOrderByInput {
  @Field(() => NovelOrderField, {
    defaultValue: NovelOrderField.NAME,
    description:
      'Novels without a chapter come last by FIRST_CHAPTER_CREATED_AT, in both directions',
  })
  @IsOptional()
  @IsEnum(NovelOrderField)
  field: NovelOrderField;

  @Field(() => OrderDirection, {
    defaultValue: OrderDirection.ASC,
  })
  @IsOptional()
  @IsEnum(OrderDirection)
  direction: OrderDirection;
}

import { Field, InputType } from '@nestjs/graphql';
import { IsDate, IsOptional } from 'class-validator';

import { IsNotLessThan } from '../../novel/inputs';

@InputType()
export class StatsHistoryFiltersInput {
  @Field(() => Date, {
    nullable: true,
    description:
      'The first day to return, inclusive. Only the UTC day of the value counts.',
  })
  @IsOptional()
  @IsDate()
  from?: Date;

  @Field(() => Date, {
    nullable: true,
    description:
      'The last day to return, inclusive. Only the UTC day of the value counts. A 400 when it is earlier than `from`, compared as timestamps, not as days.',
  })
  @IsOptional()
  @IsDate()
  @IsNotLessThan('from')
  to?: Date;
}

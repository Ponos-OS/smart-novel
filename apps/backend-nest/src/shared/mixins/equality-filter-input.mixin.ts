import { Field, InputType, ReturnTypeFunc } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsOptional } from 'class-validator';
import { Class } from 'nestjs-backend-common';

/**
 * @description simple GraphQL filter with an optional `eq` field.
 */
export function EqualityFilterInputMixin<T>(
  typeFn: ReturnTypeFunc,
): Class<{ eq?: T }> {
  @InputType({ isAbstract: true })
  class EqualityFilterInput {
    @Field(typeFn, {
      nullable: true,
      description: 'Value to match',
    })
    @IsOptional()
    @Transform(({ value }) =>
      typeof value === 'string' ? value.toLowerCase() : value,
    )
    eq?: T;
  }

  return EqualityFilterInput;
}

import { Field, InputType, ReturnTypeFunc } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsArray, IsOptional } from 'class-validator';
import { Class } from 'nestjs-backend-common';

/**
 * @description simple GraphQL filter with optional `in` and `nin` fields for list-based filtering.
 */
export function ListFilterInputMixin<T>(
  typeFn: ReturnTypeFunc,
): Class<{ in?: T[]; nin?: T[] }> {
  @InputType({ isAbstract: true })
  class ListFilterInput {
    @Field(() => [typeFn()], {
      nullable: true,
      description: 'Values to include',
    })
    @IsOptional()
    @Transform(({ value }) =>
      value.map((v: any) => (typeof v === 'string' ? v.trim() : v)),
    )
    @IsArray()
    in?: T[];

    @Field(() => [typeFn()], {
      nullable: true,
      description: 'Values to exclude',
    })
    @IsOptional()
    @Transform(({ value }) =>
      value.map((v: any) => (typeof v === 'string' ? v.trim() : v)),
    )
    @IsArray()
    nin?: T[];
  }

  return ListFilterInput;
}

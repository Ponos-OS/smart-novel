import { Field, InputType } from '@nestjs/graphql';
import { WriterRequestStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

@InputType()
export class WriterRequestFiltersInput {
  @Field(() => WriterRequestStatus, {
    nullable: true,
    description: 'Defaults to PENDING',
  })
  @IsOptional()
  @IsEnum(WriterRequestStatus)
  status?: WriterRequestStatus;
}

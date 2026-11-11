import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class CreateChapterInput {
  @Field(() => String, { description: 'Chapter title' })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  title!: string;

  @Field(() => String, {
    description: 'Chapter content in markdown format',
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  content!: string;
}

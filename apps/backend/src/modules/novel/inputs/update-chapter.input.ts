import { InputType, PartialType } from '@nestjs/graphql';

import { CreateChapterInput } from './create-chapter.input';

@InputType()
export class UpdateChapterInput extends PartialType(
  CreateChapterInput,
) {}

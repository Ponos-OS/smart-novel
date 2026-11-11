import { InputType } from '@nestjs/graphql';

import { RequestTagInput } from './request-tag.input';

@InputType()
export class CreateTagInput extends RequestTagInput {}

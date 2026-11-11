import { InputType, PartialType } from '@nestjs/graphql';

import { RequestTagInput } from './request-tag.input';

@InputType()
export class UpdateTagInput extends PartialType(RequestTagInput) {}

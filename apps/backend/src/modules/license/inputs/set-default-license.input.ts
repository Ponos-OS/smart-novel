import { Field, ID, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsOptional, IsUUID, ValidateNested } from 'class-validator';

import { LicenseDraftInput } from './license-draft.input';

@InputType()
export class SetDefaultLicenseInput {
  @Field(() => ID, {
    nullable: true,
    description:
      'An existing license. Exclusive with `licenseDraft`.',
  })
  @IsOptional()
  @IsUUID()
  licenseId?: string;

  @Field(() => LicenseDraftInput, {
    nullable: true,
    description: 'A new license text. Exclusive with `licenseId`.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LicenseDraftInput)
  licenseDraft?: LicenseDraftInput;
}

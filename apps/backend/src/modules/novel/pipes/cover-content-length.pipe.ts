import {
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { COVER_MAX_SIZE_BYTES } from '@smart-novel/shared';

/**
 * @description Validates that the value is a cover size in bytes: at least 1 and at most {@link COVER_MAX_SIZE_BYTES}.
 */
@Injectable()
export class CoverContentLengthPipe implements PipeTransform<
  number,
  number
> {
  transform(value: number): number {
    if (
      !Number.isInteger(value) ||
      value < 1 ||
      value > COVER_MAX_SIZE_BYTES
    ) {
      throw new BadRequestException(
        `Cover must be between 1 byte and ${COVER_MAX_SIZE_BYTES} bytes`,
      );
    }

    return value;
  }
}

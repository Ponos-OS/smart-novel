import {
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

import { COVER_CONTENT_TYPE_EXTENSIONS } from '../constants';

/**
 * @description Validates that the value is one of the allowed cover image MIME types.
 */
@Injectable()
export class CoverContentTypePipe implements PipeTransform<
  string,
  string
> {
  transform(value: string): string {
    // `hasOwn`, not `in` or a lookup: `constructor` or `toString` must not count as a type.
    if (!Object.hasOwn(COVER_CONTENT_TYPE_EXTENSIONS, value)) {
      throw new BadRequestException(
        `Cover must be one of: ${Object.keys(COVER_CONTENT_TYPE_EXTENSIONS).join(', ')}`,
      );
    }

    return value;
  }
}

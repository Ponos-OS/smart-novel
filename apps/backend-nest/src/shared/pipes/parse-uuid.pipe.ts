import {
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { isArray, isUUID } from 'class-validator';

/**
 * @description Validates that the input value(s) is a valid UUID string or an array of valid UUID strings.
 */
@Injectable()
export class ParseUuidPipe implements PipeTransform<
  string | string[],
  string | string[]
> {
  transform(value: string | string[]): string | string[] {
    const values = isArray(value) ? value : [value];

    for (const v of values) {
      if (!isUUID(v)) {
        throw new BadRequestException(`Invalid UUID: ${v}`);
      }
    }

    return value;
  }
}

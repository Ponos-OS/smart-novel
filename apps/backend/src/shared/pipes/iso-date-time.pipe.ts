import {
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { isISO8601 } from 'class-validator';

@Injectable()
export class IsoDateTimePipe implements PipeTransform<
  string,
  string
> {
  transform(value: string): string {
    if (!isISO8601(value)) {
      throw new BadRequestException(
        `Invalid ISO 8601 timestamp: ${value}`,
      );
    }

    return value;
  }
}

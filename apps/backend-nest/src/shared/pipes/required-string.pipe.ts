import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { isNotEmpty, isString } from 'class-validator';

@Injectable()
export class RequiredStringPipe implements PipeTransform {
  transform(value: any, _metadata: ArgumentMetadata) {
    const trimmedValue = isString(value) ? value.trim() : null;

    if (isNotEmpty(trimmedValue)) {
      return trimmedValue;
    }

    throw new BadRequestException('String cannot be empty');
  }
}

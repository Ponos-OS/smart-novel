import {
  PenNameProblem,
  WRITER_PEN_NAME_MAX_LENGTH,
  WRITER_PEN_NAME_MIN_LENGTH,
  WRITER_PEN_NAME_PATTERN,
} from '../generated/shared';

/**
 * @description What is wrong with a pen name, or null when it is fine. The value is expected to be trimmed already.
 */
export function getPenNameProblem(
  value: string,
): PenNameProblem | null {
  if (value.length === 0) {
    return 'EMPTY';
  }
  if (!WRITER_PEN_NAME_PATTERN.test(value)) {
    return 'INVALID_CHARACTERS';
  }
  if (value.length < WRITER_PEN_NAME_MIN_LENGTH) {
    return 'TOO_SHORT';
  }
  if (value.length > WRITER_PEN_NAME_MAX_LENGTH) {
    return 'TOO_LONG';
  }

  return null;
}

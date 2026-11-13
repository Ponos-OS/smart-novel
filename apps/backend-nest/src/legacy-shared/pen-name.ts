// Kept here only until the NestJS backend is removed: the Go backend checks the pen name with schema directives.
export type PenNameProblem =
  | 'EMPTY'
  | 'TOO_SHORT'
  | 'TOO_LONG'
  | 'INVALID_CHARACTERS';

export const WRITER_PEN_NAME_MIN_LENGTH = 3;
export const WRITER_PEN_NAME_MAX_LENGTH = 50;
export const WRITER_PEN_NAME_PATTERN = new RegExp('^[A-Za-z_-]+$');

export const PEN_NAME_PROBLEM_MESSAGES: Record<
  PenNameProblem,
  string
> = {
  EMPTY: 'Choose a pen name',
  TOO_SHORT: `A pen name needs at least ${WRITER_PEN_NAME_MIN_LENGTH} characters`,
  TOO_LONG: `A pen name can have at most ${WRITER_PEN_NAME_MAX_LENGTH} characters`,
  INVALID_CHARACTERS:
    'A pen name can only have English letters, hyphens and underscores',
};

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

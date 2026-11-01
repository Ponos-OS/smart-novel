import {
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { validateCronExpression } from 'cron';

/**
 * @description Passes when the value is a cron expression the scheduler accepts (five fields, or six with seconds, or a macro such as `@daily`).
 */
export function IsCronExpression(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isCronExpression',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' &&
          validateCronExpression(value).valid,
        defaultMessage: ({ property } = {} as never) =>
          `${property} must be a valid cron expression, for example "0 3 * * *"`,
      },
    });
}

import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

/**
 * @description Passes when the value is not below the sibling `property`, or when either is missing.
 */
export function IsNotLessThan(
  property: string,
  options?: ValidationOptions,
) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isNotLessThan',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options,
      validator: {
        validate(value: unknown, args?: ValidationArguments) {
          const other = (
            args?.object as Record<string, unknown> | undefined
          )?.[args?.constraints[0] ?? ''];

          if (value == null || other == null) {
            return true;
          }

          return (value as number | Date) >= (other as number | Date);
        },
        defaultMessage: (args?: ValidationArguments) =>
          `${args?.property} must not be less than ${args?.constraints[0]}`,
      },
    });
}

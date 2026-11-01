/**
 * @description The UTC midnight of the day `date` falls on, whatever the timezone of the machine.
 */
export function toUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    ),
  );
}

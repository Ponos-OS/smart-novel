const DEFAULT_SECONDS = 5;

/**
 * @description How often a draft in progress is saved: `VITE_LICENSE_DRAFT_AUTOSAVE_SECONDS`, or 5 when it is missing or not a positive number.
 */
export function getAutosaveIntervalMs(
  value: string | undefined = import.meta.env
    .VITE_LICENSE_DRAFT_AUTOSAVE_SECONDS,
): number {
  const seconds = Number(value);

  return (
    (Number.isFinite(seconds) && seconds > 0
      ? seconds
      : DEFAULT_SECONDS) * 1000
  );
}

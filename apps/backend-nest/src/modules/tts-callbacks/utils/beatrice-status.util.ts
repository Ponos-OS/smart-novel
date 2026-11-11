// The anti-corruption layer for Beatrice's `status` vocabulary. These two are the only ones we care about.
const BEATRICE_TERMINAL_SUCCESS_STATUS = 'completed';
const BEATRICE_TERMINAL_FAILURE_STATUS = 'failed';

/**
 * @description
 * Stages we know Beatrice sends before a terminal status.
 * Never branched on them.
 */
const BEATRICE_KNOWN_TRANSIENT_STATUSES = new Set([
  'queued',
  'generating',
  'uploading',
]);

export function isBeatriceTerminalSuccess(status: string): boolean {
  return status === BEATRICE_TERMINAL_SUCCESS_STATUS;
}

export function isBeatriceTerminalFailure(status: string): boolean {
  return status === BEATRICE_TERMINAL_FAILURE_STATUS;
}

export function isBeatriceTerminal(status: string): boolean {
  return (
    isBeatriceTerminalSuccess(status) ||
    isBeatriceTerminalFailure(status)
  );
}

/**
 * @description
 * False for any status outside what this backend release was written against.
 * A signal Beatrice's vocabulary drifted, not a rejection.
 */
export function isKnownBeatriceStatus(status: string): boolean {
  return (
    isBeatriceTerminal(status) ||
    BEATRICE_KNOWN_TRANSIENT_STATUSES.has(status)
  );
}

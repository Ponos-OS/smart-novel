/** @description A new message from the author. */
export const LICENSE_ASSISTANT_MESSAGE_MAX_LENGTH = 2000;
/** @description A turn of the history sent back: the assistant's replies and the summary are longer than a message. Fithara rejects a longer one. */
export const LICENSE_ASSISTANT_TURN_MAX_LENGTH = 4000;
/** @description Fithara rejects a history with more turns. It condenses its own before it gets there, so only a client that edits the history can hit this. */
export const LICENSE_ASSISTANT_MAX_TURNS = 50;

/** @description GraphQL `extensions.code` values of the license assistant errors. */
export const LICENSE_ASSISTANT_RATE_LIMITED =
  'LICENSE_ASSISTANT_RATE_LIMITED';
export const LICENSE_ASSISTANT_UNAVAILABLE =
  'LICENSE_ASSISTANT_UNAVAILABLE';
export const LICENSE_ASSISTANT_INVALID_REQUEST =
  'LICENSE_ASSISTANT_INVALID_REQUEST';
export const CANONICAL_LICENSE_NOT_FOUND =
  'CANONICAL_LICENSE_NOT_FOUND';
export const CANONICAL_LICENSE_RETIRED = 'CANONICAL_LICENSE_RETIRED';

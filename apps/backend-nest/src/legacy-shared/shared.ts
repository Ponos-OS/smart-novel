// Frozen copy of the constants the NestJS backend still imports. It was generated from spec/shared.json, which is gone; the file is deleted with the NestJS backend (REQUIREMENTS.md, step 11).

export const COVER_MAX_SIZE_BYTES = 5242880;

export const LICENSE_NAME_MAX_LENGTH = 200;

/** @description The longest canonical text (CC BY-NC-SA 4.0) is about 20k characters. */
export const LICENSE_TEXT_MAX_LENGTH = 100000;

/** @description Drafts a writer can have at a time; they finish or discard one to start another. */
export const LICENSE_DRAFTS_PER_WRITER_MAX = 20;

export const LICENSE_SEARCH_MAX_LENGTH = 100;

/** @description A new message from the author. */
export const LICENSE_ASSISTANT_MESSAGE_MAX_LENGTH = 2000;

/** @description A turn of the history sent back: the assistant's replies and the summary are longer than a message. Fithara rejects a longer one. */
export const LICENSE_ASSISTANT_TURN_MAX_LENGTH = 4000;

/** @description Fithara rejects a history with more turns. It condenses its own before it gets there, so only a client that edits the history can hit this. */
export const LICENSE_ASSISTANT_MAX_TURNS = 50;

/** @description Most chapter IDs a single markChaptersRead request accepts. */
export const MARK_CHAPTERS_READ_MAX_BATCH_SIZE = 100;

/** @description Most writers a novel list can be narrowed to. */
export const NOVEL_OWNER_IDS_MAX_SIZE = 100;

export const TAG_DESCRIPTION_MAX_LENGTH = 650;

export const TAG_NAME_MAX_LENGTH = 50;

export const WRITER_NOTE_MAX_LENGTH = 1000;

export const WRITER_SEARCH_MAX_LENGTH = 100;

/** @description Message of the 400 answered for a pagination cursor the backend did not issue, or one that belongs to another query. */
export const INVALID_CURSOR = 'INVALID_CURSOR';

export const INVALID_CURSOR_MESSAGE = 'Invalid cursor';

/** @description GraphQL extensions.code when the request has no token or an invalid one. */
export const UNAUTHENTICATED = 'UNAUTHENTICATED';

/** @description GraphQL extensions.code when the caller is authenticated but lacks the role or ownership. */
export const FORBIDDEN = 'FORBIDDEN';

/** @description GraphQL extensions.code when the novel, chapter or tag asked for does not exist. */
export const NOT_FOUND = 'NOT_FOUND';

/** @description GraphQL extensions.code when the record changed since the client read it, so its edit would overwrite someone else's. */
export const CONFLICT = 'CONFLICT';

/** @description GraphQL extensions.code of an argument that is malformed, for example an ID that is not a UUID. */
export const BAD_REQUEST = 'BAD_REQUEST';

/** @description GraphQL extensions.code of a platform terms error. */
export const PLATFORM_TERMS_NOT_ACCEPTED =
  'PLATFORM_TERMS_NOT_ACCEPTED';

/** @description GraphQL extensions.code of a platform terms error. */
export const PLATFORM_TERMS_VERSION_MISMATCH =
  'PLATFORM_TERMS_VERSION_MISMATCH';

/** @description GraphQL extensions.code of a license assistant error. */
export const LICENSE_ASSISTANT_RATE_LIMITED =
  'LICENSE_ASSISTANT_RATE_LIMITED';

/** @description GraphQL extensions.code of a license assistant error. */
export const LICENSE_ASSISTANT_UNAVAILABLE =
  'LICENSE_ASSISTANT_UNAVAILABLE';

/** @description GraphQL extensions.code of a license assistant error. */
export const LICENSE_ASSISTANT_INVALID_REQUEST =
  'LICENSE_ASSISTANT_INVALID_REQUEST';

/** @description GraphQL extensions.code of a license assistant error. */
export const CANONICAL_LICENSE_NOT_FOUND =
  'CANONICAL_LICENSE_NOT_FOUND';

/** @description GraphQL extensions.code of a license assistant error. */
export const CANONICAL_LICENSE_RETIRED = 'CANONICAL_LICENSE_RETIRED';

/** @description extensions.code of the 409 that requestWriterAccess answers when another writer already has the pen name, in any case. */
export const PEN_NAME_TAKEN = 'PEN_NAME_TAKEN';

/** @description Allowed cover image MIME types and the extension the backend gives their object key. */
export const COVER_CONTENT_TYPE_EXTENSIONS: Readonly<
  Record<string, string>
> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** @description Application roles, highest level first. A higher level has every privilege of the lower ones. */
export enum Role {
  admin = 'admin',
  user = 'user',
  writer = 'writer',
}

/** @description Higher number = more privileges. */
export const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.admin]: 3,
  [Role.writer]: 2,
  [Role.user]: 1,
};

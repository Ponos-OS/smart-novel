import { MongoAbility } from '@casl/ability';

import { Action } from './action.enum';

/**
 * @description The real fields a `Novel` subject is checked against — always a genuine
 * `{ ownerId }` selected off the actual row, tagged via CASL's `subject('Novel', novel)`.
 */
export interface NovelSubject {
  ownerId: string;
}

/**
 * @description
 * A `Chapter` subject at check time. There's no real `ownerId` field on `Chapter` itself
 * (ownership lives on the parent `Novel`), so this is always a stand-in object carrying the
 * parent novel's owner id, tagged via `subject('Chapter', { novelOwnerId })` — never a real
 * `Chapter` row.
 */
export interface ChapterSubject {
  novelOwnerId: string | null;
}

export type AppSubjects =
  | 'Novel'
  | 'Chapter'
  | 'all'
  | NovelSubject
  | ChapterSubject;

export type AppAbility = MongoAbility<[Action, AppSubjects]>;

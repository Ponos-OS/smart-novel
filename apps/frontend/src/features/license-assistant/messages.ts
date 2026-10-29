import { LICENSE_DISCLAIMER } from '../novel-license/license-notice';

/**
 * @description Every sentence the license assistant shows, in English. A translation is another object with the same keys. The disclaimers the assistant sends with an answer, the licenses and what the author and the assistant write are shown as they come, and canonical license ids are never translated.
 */
export const enMessages = {
  'conversation.title': 'Conversation',
  'conversation.log': 'Conversation with the license assistant',
  'message.you': 'You',
  'message.assistant': 'Assistant',
  'message.youSending': 'You (sending...)',
  'composer.label': 'Your message',
  'composer.placeholder':
    'Tell the assistant how others may use your novel',
  'composer.counter':
    '{count} / {max} - Enter sends, Shift+Enter adds a line',
  'composer.counterTooLong':
    '{count} / {max} - too long, shorten it to send',
  'composer.send': 'Send',
  'composer.sending': 'Sending...',
  'error.reference': '{message} (reference: {requestId})',
  'error.termsNotAccepted':
    'Accept the platform terms to use the assistant.',
  'error.rateLimited':
    'You sent too many messages to the assistant. Try again in a while.',
  'error.unavailable':
    'The assistant is not available right now. Your conversation and draft are kept; try again later.',
  'error.invalidRequest':
    'The assistant could not take that message. Shorten it, or the draft, and try again.',
  'error.licenseNotFound':
    'That license is not in the list of canonical licenses.',
  'error.licenseRetired':
    'That license is no longer offered for new drafts. Pick another one.',
  'error.unknown': 'Something went wrong. Try again later.',
  'draft.title': 'Draft license',
  'draft.empty':
    'No draft yet. Tell the assistant what you want, and it will propose one here.',
  'draft.updated': 'The assistant updated the draft.',
  'draft.unchanged': 'The draft did not change in this answer.',
  'sync.saved': 'All changes saved',
  'sync.saving': 'Saving...',
  'sync.unsaved': 'Changes not saved yet, saving soon',
  'sync.failed': 'Not saved. Trying again.',
  'source.canonical': 'Canonical license: {name}',
  'source.forked':
    'Modified from {name} — not the same as the canonical license',
  'source.custom': 'Custom license — review with a lawyer.',
  'disclaimers.title': 'Disclaimers',
  'statement.notLegalAdvice': LICENSE_DISCLAIMER,
  'finalize.button': 'Finalize this license',
  'finalize.busy': 'Finalizing...',
  'finalize.ready':
    'The assistant thinks this draft is ready. It is your decision.',
  'recommendations.title': 'Suggested licenses',
  'recommendations.use': 'Use {name}',
  'recommendations.read': 'Read {name}',
  'recommendations.prefill':
    'I would like to use {name} for my novel.',
  'dialog.close': 'Close',
  'license.loading': 'Loading the license...',
  'license.summary': '{shortName}, version {version}, {category}',
  'license.permissions': 'Permissions',
  'license.limitations': 'Limitations',
  'license.conditions': 'Conditions',
  'license.fullText': 'Full text',
  'license.officialLink':
    'Read the official license text (opens in a new tab)',
  'start.title': 'Start a license draft',
  'start.customize': 'Customize {name}',
  'start.writeOwn': 'Write my own',
  'start.unfinished': 'Your unfinished drafts',
  'start.untitled': 'Untitled draft',
  'start.saved': 'Saved {date}',
  'start.continue': 'Continue {title}',
  'start.discard': 'Discard {title}',
  'start.startOver': 'Start over',
  'restore.loading': 'Loading your draft...',
  'restore.failed': 'Your draft could not be loaded.',
  'restore.retry': 'Try again',
  'session.generic': 'Something went wrong. Try again later.',
  'session.leaveFailed':
    'Your latest changes could not be saved. Try again in a moment.',
  'session.finalizeFailed':
    'Your latest changes could not be saved, so the draft was not finalized. Try again in a moment.',
} as const;

export type MessageKey = keyof typeof enMessages;
export type Messages = Record<MessageKey, string>;

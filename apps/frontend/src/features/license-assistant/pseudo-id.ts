interface Turn {
  role: string;
  content: string;
}

/**
 * @description A key for a turn of the conversation, which has no id of its own: a hash of what it says, with a counter for the turns that say the same thing. It only has to keep React's keys stable and distinct, so a fast non-cryptographic hash (FNV-1a) is enough.
 */
export function withPseudoIds<T extends Turn>(
  turns: T[],
): (T & { id: string })[] {
  const seen = new Map<string, number>();

  return turns.map((turn) => {
    const hash = fnv1a(`${turn.role}\n${turn.content}`);
    const occurrence = seen.get(hash) ?? 0;

    seen.set(hash, occurrence + 1);

    return { ...turn, id: `${hash}-${occurrence}` };
  });
}

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36);
}

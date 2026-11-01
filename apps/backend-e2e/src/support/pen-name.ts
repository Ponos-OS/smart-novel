/**
 * @description A pen name nobody has: letters and an underscore only, since digits are not allowed in a pen name.
 */
export function uniquePenName(prefix = 'Pen'): string {
  const letters = Array.from({ length: 12 }, () =>
    String.fromCharCode(97 + Math.floor(Math.random() * 26)),
  ).join('');

  return `${prefix}_${letters}`;
}

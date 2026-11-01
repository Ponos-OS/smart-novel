const compact = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** @description `1204` becomes `~1.2k`: the tilde because the figure is a database estimate. */
export function formatEstimate(count: number): string {
  return `~${compact.format(count).replace('K', 'k')}`;
}

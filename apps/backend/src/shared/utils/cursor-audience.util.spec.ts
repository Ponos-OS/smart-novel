import { buildAudience } from './cursor-audience.util';

describe(buildAudience.name, () => {
  const novelId = 'c1d31ec2-f478-4648-b90b-d1e53de2a829';

  it('should give a short url-safe identity', () => {
    const result = buildAudience('chapters', { novelId });

    expect(result).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it('should not depend on key order or on undefined values', () => {
    const first = buildAudience('chapters', {
      novelId,
      filters: { narrationStatus: 'READY', other: undefined },
    });

    const second = buildAudience('chapters', {
      filters: { other: undefined, narrationStatus: 'READY' },
      novelId,
      orderBy: undefined,
    });

    expect(second).toBe(first);
  });

  it.each([
    ['connection', () => buildAudience('novels', { novelId })],
    [
      'scope',
      () =>
        buildAudience('chapters', {
          novelId: '9d154762-d77f-42b4-add2-cf1d234d1a21',
        }),
    ],
    [
      'sort',
      () => buildAudience('chapters', { novelId, direction: 'DESC' }),
    ],
    [
      'filter',
      () =>
        buildAudience('chapters', {
          novelId,
          filters: { narrationStatus: 'FAILED' },
        }),
    ],
    [
      'filter list order',
      () =>
        buildAudience('chapters', {
          novelId,
          filters: { in: ['b', 'a'] },
        }),
    ],
  ])('should change when the %s changes', (_part, changed) => {
    const base = buildAudience('chapters', {
      novelId,
      filters: { in: ['a', 'b'] },
    });

    expect(changed()).not.toBe(base);
  });
});

import { normalizeTagNames } from './normalize-tag-names.util';

describe(normalizeTagNames.name, () => {
  it('should trim, lowercase and dedupe the names', () => {
    const result = normalizeTagNames([
      ' Fantasy ',
      'fantasy',
      'Sci-Fi',
    ]);

    expect(result).toEqual(['fantasy', 'sci-fi']);
  });

  it.each([undefined, null, 'fantasy'])(
    'should return %s untouched so the validators can reject it',
    (value) => {
      const result = normalizeTagNames(value);

      expect(result).toBe(value);
    },
  );

  it('should keep non-string entries so the validators can reject them', () => {
    const result = normalizeTagNames(['fantasy', 42]);

    expect(result).toEqual(['fantasy', 42]);
  });
});

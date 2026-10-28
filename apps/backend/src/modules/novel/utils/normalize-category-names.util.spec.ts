import { normalizeCategoryNames } from './normalize-category-names.util';

describe(normalizeCategoryNames.name, () => {
  it('should trim, lowercase and dedupe the names', () => {
    const result = normalizeCategoryNames([
      ' Fantasy ',
      'fantasy',
      'Sci-Fi',
    ]);

    expect(result).toEqual(['fantasy', 'sci-fi']);
  });

  it.each([undefined, null, 'fantasy'])(
    'should return %s untouched so the validators can reject it',
    (value) => {
      const result = normalizeCategoryNames(value);

      expect(result).toBe(value);
    },
  );

  it('should keep non-string entries so the validators can reject them', () => {
    const result = normalizeCategoryNames(['fantasy', 42]);

    expect(result).toEqual(['fantasy', 42]);
  });
});

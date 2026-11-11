import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { LicenseScope } from '../types';
import { LicenseFiltersInput } from './license-filters.input';

describe(LicenseFiltersInput.name, () => {
  it('should trim the search text', async () => {
    const input = plainToInstance(LicenseFiltersInput, {
      search: '  cc by ',
    });

    const errors = await validate(input);

    expect(errors).toBeEmpty();
    expect(input.search).toBe('cc by');
  });

  it('should refuse a search text over the limit', async () => {
    const input = plainToInstance(LicenseFiltersInput, {
      search: 'a'.repeat(101),
    });

    const errors = await validate(input);

    expect(errors).toHaveLength(1);
  });

  it('should refuse an unknown scope', async () => {
    const input = plainToInstance(LicenseFiltersInput, {
      scope: 'PRIVATE',
    });

    const errors = await validate(input);

    expect(errors).toHaveLength(1);
  });

  it('should accept a known scope', async () => {
    const input = plainToInstance(LicenseFiltersInput, {
      scope: LicenseScope.DRAFT,
    });

    const errors = await validate(input);

    expect(errors).toBeEmpty();
  });
});

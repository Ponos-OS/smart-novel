import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { WriterRequestFiltersInput } from './writer-request-filters.input';

describe(WriterRequestFiltersInput.name, () => {
  it('should trim the search text', async () => {
    const input = plainToInstance(WriterRequestFiltersInput, {
      search: '  mina ardalan ',
    });

    const errors = await validate(input);

    expect(errors).toBeEmpty();
    expect(input.search).toBe('mina ardalan');
  });

  it('should refuse a search text over the limit', async () => {
    const input = plainToInstance(WriterRequestFiltersInput, {
      search: 'a'.repeat(101),
    });

    const errors = await validate(input);

    expect(errors).toHaveLength(1);
  });
});

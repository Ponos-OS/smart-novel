import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { WriterFiltersInput } from './writer-filters.input';

describe(WriterFiltersInput.name, () => {
  it('should trim the search text', async () => {
    const input = plainToInstance(WriterFiltersInput, {
      search: '  mina ardalan ',
    });

    const errors = await validate(input);

    expect(errors).toBeEmpty();
    expect(input.search).toBe('mina ardalan');
  });

  it('should refuse a search text over the limit', async () => {
    const input = plainToInstance(WriterFiltersInput, {
      search: 'a'.repeat(101),
    });

    const errors = await validate(input);

    expect(errors).toHaveLength(1);
  });
});

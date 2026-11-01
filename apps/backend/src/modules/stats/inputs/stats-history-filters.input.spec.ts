import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { StatsHistoryFiltersInput } from './stats-history-filters.input';

describe(StatsHistoryFiltersInput.name, () => {
  it('should accept a range from the earlier day to the later one', async () => {
    const input = plainToInstance(StatsHistoryFiltersInput, {
      from: new Date('2026-10-01T00:00:00.000Z'),
      to: new Date('2026-10-31T00:00:00.000Z'),
    });

    const errors = await validate(input);

    expect(errors).toBeEmpty();
  });

  it('should refuse an end before the start', async () => {
    const input = plainToInstance(StatsHistoryFiltersInput, {
      from: new Date('2026-10-31T00:00:00.000Z'),
      to: new Date('2026-10-01T00:00:00.000Z'),
    });

    const errors = await validate(input);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('to');
  });
});

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { EnvironmentVariables } from './app.config';

const errorsOf = async (value: unknown) => {
  const errors = await validate(
    plainToInstance(EnvironmentVariables, {
      STATS_SNAPSHOT_CRON: value,
    }),
    { skipMissingProperties: false },
  );

  return errors.filter(
    ({ property }) => property === 'STATS_SNAPSHOT_CRON',
  );
};

describe('STATS_SNAPSHOT_CRON', () => {
  it.each(['0 3 * * *', '*/30 2-4 * * *', '@daily'])(
    'should accept %s',
    async (cron) => {
      expect(await errorsOf(cron)).toBeEmpty();
    },
  );

  it.each([
    { scenario: 'missing', value: undefined },
    { scenario: 'empty', value: '' },
    { scenario: 'malformed', value: 'every night at three' },
    { scenario: 'out of range', value: '0 25 * * *' },
    { scenario: 'missing a field', value: '0 3 * *' },
  ])('should refuse a value that is $scenario', async ({ value }) => {
    expect(await errorsOf(value)).toHaveLength(1);
  });
});

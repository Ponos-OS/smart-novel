import { validate } from 'class-validator';

import { IsCronExpression } from './is-cron-expression.validator';

class Schedule {
  @IsCronExpression()
  cron: unknown;
}

const check = async (cron: unknown) => {
  const schedule = new Schedule();
  schedule.cron = cron;

  return validate(schedule);
};

describe(IsCronExpression.name, () => {
  it.each([
    '0 3 * * *',
    '*/15 * * * *',
    '30 2 * * 1-5',
    '0 0 3 * * *',
    '@daily',
  ])('should accept %s', async (cron) => {
    expect(await check(cron)).toBeEmpty();
  });

  it.each([
    { cron: '', scenario: 'an empty string' },
    { cron: '0 3 * *', scenario: 'too few fields' },
    { cron: '0 99 * * *', scenario: 'an hour that does not exist' },
    { cron: 'every night', scenario: 'words' },
    { cron: undefined, scenario: 'nothing' },
    { cron: 3, scenario: 'a number' },
  ])('should refuse $scenario', async ({ cron }) => {
    const errors = await check(cron);

    expect(errors).toHaveLength(1);
    expect(Object.values(errors[0].constraints ?? {})[0]).toContain(
      'valid cron expression',
    );
  });
});

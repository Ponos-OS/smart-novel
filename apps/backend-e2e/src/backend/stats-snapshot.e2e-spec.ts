import { ClusterFixture } from '../support';

describe('Stats snapshots (e2e)', () => {
  it('keeps one snapshot for the current UTC day after the boot catch-up', () => {
    // Act
    const rows = ClusterFixture.queryDatabase(
      `SELECT count(*) FROM stats_snapshots WHERE day = (now() AT TIME ZONE 'UTC')::date;`,
    );

    // Assert
    expect(rows).toBe('1');
  });

  it('refuses a second snapshot for the same day', () => {
    // Act
    const insertTwice = () =>
      ClusterFixture.queryDatabase(
        `INSERT INTO stats_snapshots (id, day, novel_count, chapter_count)
         VALUES (gen_random_uuid(), (now() AT TIME ZONE 'UTC')::date, 0, 0);`,
      );

    // Assert
    expect(insertTwice).toThrow(/UQ_stats_snapshots_day/);
  });
});

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

  it('has a unique index on the day, so a second snapshot of a day cannot exist', () => {
    // Act
    const inserted = ClusterFixture.queryDatabase(
      `INSERT INTO stats_snapshots (id, day, novel_count, chapter_count)
       VALUES (gen_random_uuid(), (now() AT TIME ZONE 'UTC')::date, 0, 0)
       ON CONFLICT (day) DO NOTHING
       RETURNING id;`,
    );

    // Assert
    expect(inserted).toBe('INSERT 0 0');
  });
});

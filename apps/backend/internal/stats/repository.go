package stats

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/statssnapshot"
)

// repository is the only place of this package that builds ent queries. It decides nothing and returns the database's own errors.
type repository struct {
	client *ent.Client
}

func newRepository(client *ent.Client) *repository {
	return &repository{client: client}
}

func (r *repository) snapshotExists(
	ctx context.Context,
	day time.Time,
) (bool, error) {
	return r.client.StatsSnapshot.Query().
		Where(statssnapshot.Day(day)).
		Exist(ctx)
}

// counts are exact, which is what the growth charts plot; the live totals are the planner's estimates.
func (r *repository) counts(
	ctx context.Context,
) (novels, chapters int, err error) {
	if novels, err = r.client.Novel.Query().Count(ctx); err != nil {
		return 0, 0, err
	}
	chapters, err = r.client.Chapter.Query().Count(ctx)

	return novels, chapters, err
}

// insertSnapshot writes the row of a day and reports whether this call wrote it; a row of that day that is there already is left alone.
func (r *repository) insertSnapshot(
	ctx context.Context,
	day time.Time,
	novels, chapters int,
) (bool, error) {
	err := r.client.StatsSnapshot.Create().
		SetDay(day).SetNovelCount(novels).SetChapterCount(chapters).
		OnConflictColumns(statssnapshot.FieldDay).DoNothing().
		Exec(ctx)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil // the day had its row: nothing was inserted, so no row came back
	}

	return err == nil, err
}

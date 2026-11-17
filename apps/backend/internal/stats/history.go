package stats

import (
	"time"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/apperr"
)

// WithinDays makes the bounds of a history filter whole UTC days, since a snapshot is one per day and only the day of a bound counts.
// A range that ends before it starts is refused, compared as the clients sent them.
func WithinDays(
	where *ent.StatsSnapshotWhereInput,
) (*ent.StatsSnapshotWhereInput, error) {
	if where == nil {
		return nil, nil
	}
	if where.DayGTE != nil && where.DayLTE != nil &&
		where.DayLTE.Before(*where.DayGTE) {
		return nil, apperr.BadRequest(
			"filters.to cannot be earlier than filters.from",
		)
	}
	bounded := *where
	bounded.DayGTE = utcDay(where.DayGTE)
	bounded.DayLTE = utcDay(where.DayLTE)

	return &bounded, nil
}

func utcDay(moment *time.Time) *time.Time {
	if moment == nil {
		return nil
	}
	year, month, day := moment.UTC().Date()
	truncated := time.Date(year, month, day, 0, 0, 0, 0, time.UTC)

	return &truncated
}

package stats

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/robfig/cron/v3"
)

const (
	logKeySchedule = "schedule"
	logKeyDay      = "day"
	logKeyNovels   = "novels"
	logKeyChapters = "chapters"
)

// TakeSnapshot writes the exact counts of the UTC day of now, at most once per day: the first run of a day wins and a later one, from a restart, another replica or a retry, does nothing and does not even count. It reports whether this call wrote the row.
func (s *Service) TakeSnapshot(
	ctx context.Context,
	now time.Time,
) (bool, error) {
	utc := now.UTC()
	day := time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC)
	exists, err := s.repo.snapshotExists(ctx, day)
	if err != nil || exists {
		return false, err
	}
	novels, chapters, err := s.repo.counts(ctx)
	if err != nil {
		return false, fmt.Errorf("counting the catalog: %w", err)
	}
	written, err := s.repo.insertSnapshot(ctx, day, novels, chapters)
	if err == nil && written {
		s.logger.InfoContext(
			ctx,
			"stats snapshot written",
			slog.String(logKeyDay, day.Format(time.DateOnly)),
			slog.Int(logKeyNovels, novels),
			slog.Int(logKeyChapters, chapters),
		)
	}

	return written, err
}

// KeepSnapshotted takes the snapshot of today at once, so a restart cannot leave a gap, and then on schedule (a cron expression, in UTC) until ctx ends. A failure is logged: the next tick or the next start tries again.
func (s *Service) KeepSnapshotted(ctx context.Context, spec string) {
	schedule, err := cron.ParseStandard(spec)
	if err != nil {
		s.logger.ErrorContext(
			ctx,
			"reading the schedule of the stats snapshot",
			slog.String(logKeySchedule, spec),
			slog.Any(logKeyError, err),
		)

		return
	}
	s.logger.InfoContext(
		ctx,
		"stats snapshot runner started",
		slog.String(logKeySchedule, spec),
	)
	for {
		s.snapshotAndLog(ctx)
		select {
		case <-ctx.Done():
			return
		case <-time.After(time.Until(schedule.Next(time.Now().UTC()))):
		}
	}
}

func (s *Service) snapshotAndLog(ctx context.Context) {
	if _, err := s.TakeSnapshot(ctx, time.Now()); err != nil {
		s.logger.ErrorContext(
			ctx,
			"taking the stats snapshot",
			slog.Any(logKeyError, err),
		)
	}
}

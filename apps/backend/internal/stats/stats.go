// Package stats reads the size of the catalog for the admin dashboard.
package stats

import (
	"context"
	"log/slog"
)

const (
	logKeyTable = "table"
	logKeyError = "error"
)

// RowEstimator tells how many rows a query would return, from the planner, without running it.
type RowEstimator interface {
	EstimateRows(ctx context.Context, query string, args ...any) (int, error)
}

// Totals are the planner's estimates of the whole catalog right now, not exact counts.
type Totals struct {
	EstimatedNovelCount   int
	EstimatedChapterCount int
}

type Service struct {
	estimator RowEstimator
	logger    *slog.Logger
}

func NewService(estimator RowEstimator, logger *slog.Logger) *Service {
	return &Service{estimator: estimator, logger: logger}
}

// LiveTotals is cheap enough for every page view. A figure that cannot be read is 0 and logged.
func (s *Service) LiveTotals(ctx context.Context) Totals {
	return Totals{
		EstimatedNovelCount:   s.estimateOrZero(ctx, "novels"),
		EstimatedChapterCount: s.estimateOrZero(ctx, "chapters"),
	}
}

func (s *Service) estimateOrZero(ctx context.Context, table string) int {
	estimate, err := s.estimator.EstimateRows(ctx, "SELECT 1 FROM "+table)
	if err != nil {
		s.logger.WarnContext(ctx, "estimating a table", slog.String(logKeyTable, table), slog.Any(logKeyError, err))

		return 0
	}

	return estimate
}

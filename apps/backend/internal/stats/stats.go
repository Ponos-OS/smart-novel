// Package stats reads the size of the catalog for the admin dashboard.
package stats

import (
	"context"
	"log/slog"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/graph/model"
)

const (
	logKeyTable = "table"
	logKeyError = "error"
)

// RowEstimator tells how many rows a query would return, from the planner, without running it.
type RowEstimator interface {
	EstimateRows(ctx context.Context, query string, args ...any) (int, error)
}

type Service struct {
	estimator RowEstimator
	repo      *repository
	logger    *slog.Logger
}

func NewService(
	estimator RowEstimator,
	client *ent.Client,
	logger *slog.Logger,
) *Service {
	return &Service{
		estimator: estimator,
		repo:      newRepository(client),
		logger:    logger,
	}
}

// LiveTotals is cheap enough for every page view. A figure that cannot be read is 0 and logged.
func (s *Service) LiveTotals(ctx context.Context) model.ContentStats {
	return model.ContentStats{
		EstimatedNovelCount:   s.estimateOrZero(ctx, "novels"),
		EstimatedChapterCount: s.estimateOrZero(ctx, "chapters"),
	}
}

func (s *Service) estimateOrZero(ctx context.Context, table string) int {
	estimate, err := s.estimator.EstimateRows(ctx, "SELECT 1 FROM "+table)
	if err != nil {
		s.logger.WarnContext(
			ctx,
			"estimating a table",
			slog.String(logKeyTable, table),
			slog.Any(logKeyError, err),
		)

		return 0
	}

	return estimate
}

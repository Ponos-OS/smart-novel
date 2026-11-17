package stats_test

import (
	"context"
	"errors"
	"log/slog"
	"testing"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/graph/model"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/stats"
)

type fakeEstimator map[string]int

func (f fakeEstimator) EstimateRows(
	_ context.Context,
	query string,
	_ ...any,
) (int, error) {
	count, ok := f[query]
	if !ok {
		return 0, errors.New("no estimate")
	}

	return count, nil
}

func TestLiveTotals(t *testing.T) {
	logger := slog.New(slog.DiscardHandler)
	cases := []struct {
		name      string
		estimates fakeEstimator
		want      model.ContentStats
	}{
		{
			"both read",
			fakeEstimator{
				"SELECT 1 FROM novels":   12,
				"SELECT 1 FROM chapters": 340,
			},
			model.ContentStats{
				EstimatedNovelCount:   12,
				EstimatedChapterCount: 340,
			},
		},
		{
			"one cannot be read",
			fakeEstimator{"SELECT 1 FROM novels": 12},
			model.ContentStats{EstimatedNovelCount: 12},
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			uut := stats.NewService(c.estimates, nil, logger)

			got := uut.LiveTotals(t.Context())

			if got != c.want {
				t.Errorf("LiveTotals = %+v, want %+v", got, c.want)
			}
		})
	}
}

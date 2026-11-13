package stats_test

import (
	"errors"
	"testing"
	"time"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/apperr"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/stats"
)

func TestWithinDaysKeepsOnlyTheUTCDayOfEachBound(t *testing.T) {
	from := time.Date(2001, 3, 2, 18, 0, 0, 0, time.UTC)
	to := time.Date(2001, 3, 3, 6, 0, 0, 0, time.UTC)

	result, err := stats.WithinDays(&ent.StatsSnapshotWhereInput{DayGTE: &from, DayLTE: &to})
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if want := time.Date(2001, 3, 2, 0, 0, 0, 0, time.UTC); !result.DayGTE.Equal(want) {
		t.Errorf("DayGTE = %s, want %s", result.DayGTE, want)
	}
	if want := time.Date(2001, 3, 3, 0, 0, 0, 0, time.UTC); !result.DayLTE.Equal(want) {
		t.Errorf("DayLTE = %s, want %s", result.DayLTE, want)
	}
	if from.Hour() != 18 {
		t.Error("the caller's filter was changed")
	}
}

func TestWithinDaysUsesTheUTCDayOfAnOffsetTime(t *testing.T) {
	late := time.Date(2001, 3, 2, 23, 30, 0, 0, time.FixedZone("west", -5*60*60))

	result, err := stats.WithinDays(&ent.StatsSnapshotWhereInput{DayGTE: &late})

	if want := time.Date(2001, 3, 3, 0, 0, 0, 0, time.UTC); err != nil || !result.DayGTE.Equal(want) {
		t.Errorf("DayGTE = %v, err = %v, want %s", result.DayGTE, err, want)
	}
}

func TestWithinDaysRefusesARangeThatEndsBeforeItStarts(t *testing.T) {
	from := time.Date(2001, 3, 5, 0, 0, 0, 0, time.UTC)
	to := time.Date(2001, 3, 1, 0, 0, 0, 0, time.UTC)

	_, err := stats.WithinDays(&ent.StatsSnapshotWhereInput{DayGTE: &from, DayLTE: &to})

	var bad *apperr.Error
	if !errors.As(err, &bad) || bad.Code() != apperr.CodeBadRequest {
		t.Errorf("err = %v, want a bad request", err)
	}
}

func TestWithinDaysWithoutAFilter(t *testing.T) {
	result, err := stats.WithinDays(nil)

	if result != nil || err != nil {
		t.Errorf("result = %v, err = %v, want nothing", result, err)
	}
}
